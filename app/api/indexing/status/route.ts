// @ts-nocheck
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

type IndexingStatus = 'submitted_indexed' | 'crawled_not_indexed' | 'discovered_not_indexed' | 'unknown';

interface IndexingPageRow {
  url: string;
  status: IndexingStatus;
  lastCrawl: string | null;
  richResults: boolean;
  lastInspection: string | null;
  inspectionFrequency: string;
  history?: Array<{ date: string; status: IndexingStatus }>;
  coverageState?: string;
  verdict?: string;
  pageFetchState?: string;
  robotsTxtState?: string;
}

interface IndexingStatusResponse {
  summary: Record<IndexingStatus, number>;
  daily: Array<{
    date: string;
    submitted_indexed: number;
    crawled_not_indexed: number;
    discovered_not_indexed: number;
    unknown: number;
  }>;
  pages: IndexingPageRow[];
  inspectedUrls: number;
  failedUrls: Array<{ url: string; reason: string }>;
}

const MAX_URLS = 50;
const SEARCH_ANALYTICS_ROW_LIMIT = 250;
const DAY_IN_MS = 1000 * 60 * 60 * 24;

function classifyStatus(coverageState?: string | null): IndexingStatus {
  if (!coverageState) return 'unknown';
  const normalized = coverageState.toLowerCase();
  if (normalized.includes('submitted') && normalized.includes('indexed')) return 'submitted_indexed';
  if (normalized.includes('crawled') && normalized.includes('not indexed')) return 'crawled_not_indexed';
  if (normalized.includes('discovered') && normalized.includes('not indexed')) return 'discovered_not_indexed';
  if (normalized.includes('unknown')) return 'unknown';
  return 'unknown';
}

function formatInspectionFrequency(lastCrawl: string | null): string {
  if (!lastCrawl) return 'unknown';
  const lastCrawlDate = new Date(lastCrawl);
  if (Number.isNaN(lastCrawlDate.getTime())) return 'unknown';
  const diffDays = Math.max(1, Math.round((Date.now() - lastCrawlDate.getTime()) / DAY_IN_MS));
  if (diffDays <= 1) return 'daily';
  if (diffDays <= 7) return `~every ${diffDays} days`;
  return `>${diffDays} days`;
}

function buildDailyDistribution(
  startDate: string,
  endDate: string,
  summary: Record<IndexingStatus, number>
) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const today = new Date().toISOString().split('T')[0];
    return [
      {
        date: today,
        submitted_indexed: 0,
        crawled_not_indexed: 0,
        discovered_not_indexed: 0,
        unknown: 1,
      },
    ];
  }

  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_IN_MS) + 1);
  const totalUrls = Object.values(summary).reduce((acc, value) => acc + value, 0);

  const ratios = totalUrls > 0
    ? {
        submitted_indexed: summary.submitted_indexed / totalUrls,
        crawled_not_indexed: summary.crawled_not_indexed / totalUrls,
        discovered_not_indexed: summary.discovered_not_indexed / totalUrls,
        unknown: summary.unknown / totalUrls,
      }
    : {
        submitted_indexed: 0,
        crawled_not_indexed: 0,
        discovered_not_indexed: 0,
        unknown: 1,
      };

  const daily: IndexingStatusResponse['daily'] = [];
  for (let i = 0; i < totalDays; i++) {
    const current = new Date(start.getTime() + i * DAY_IN_MS);
    daily.push({
      date: current.toISOString().split('T')[0],
      ...ratios,
    });
  }

  return daily;
}

function isValidHttpUrl(candidate: string | undefined | null): candidate is string {
  if (!candidate) return false;
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

async function resolveUrls(
  authClient: OAuth2Client,
  siteUrl: string,
  startDate: string,
  endDate: string,
  urls?: string[]
) {
  const provided = Array.from(new Set((urls || []).filter(isValidHttpUrl)));
  if (provided.length > 0) {
    return provided.slice(0, MAX_URLS);
  }

  try {
    const webmasters = google.webmasters({ version: 'v3', auth: authClient });
    const res = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate,
        endDate,
        rowLimit: SEARCH_ANALYTICS_ROW_LIMIT,
        dimensions: ['page'],
      },
    });

    const rows = res.data.rows ?? [];
    const derived = rows
      .map((row) => row.keys?.[0])
      .filter(isValidHttpUrl);

    return Array.from(new Set(derived)).slice(0, MAX_URLS);
  } catch (error) {
    console.error('Failed to load top URLs for indexing inspection:', error);
    throw new Error('Kunne ikke hente top-URL data fra Search Console.');
  }
}

async function inspectUrls(
  authClient: OAuth2Client,
  siteUrl: string,
  startDate: string,
  endDate: string,
  urls?: string[]
) {
  console.log('🔍 [Indexing API] Starting URL inspection...');
  const targetUrls = await resolveUrls(authClient, siteUrl, startDate, endDate, urls);
  console.log(`📋 [Indexing API] Resolved ${targetUrls.length} URLs to inspect`);

  if (targetUrls.length === 0) {
    return NextResponse.json(
      { error: 'Ingen URLs at inspicere for den valgte periode.' },
      { status: 404 }
    );
  }

  const searchconsole = google.searchconsole({ version: 'v1', auth: authClient });

  const summary: Record<IndexingStatus, number> = {
    submitted_indexed: 0,
    crawled_not_indexed: 0,
    discovered_not_indexed: 0,
    unknown: 0,
  };

  const pages: IndexingPageRow[] = [];
  const failedUrls: Array<{ url: string; reason: string }> = [];

  console.log('🚀 [Indexing API] Starting URL Inspection loop...');
  const startTime = Date.now();

  for (const url of targetUrls) {
    try {
      const response = await searchconsole.urlInspection.index.inspect({
        requestBody: {
          inspectionUrl: url,
          siteUrl,
        },
      });

      const result = response.data?.inspectionResult;
      const indexStatus = result?.indexStatusResult;
      const coverageState = indexStatus?.coverageState || null;
      const status = classifyStatus(coverageState);
      summary[status] += 1;

      const lastCrawl = indexStatus?.lastCrawlTime || null;
      const richResultsVerdict = result?.richResultsResult?.verdict || null;
      const pageFetchState = indexStatus?.pageFetchState;
      const robotsTxtState = indexStatus?.robotsTxtState;

      pages.push({
        url,
        status,
        lastCrawl,
        lastInspection: lastCrawl,
        inspectionFrequency: formatInspectionFrequency(lastCrawl),
        richResults: richResultsVerdict === 'VERDICT_PASS',
        history: [],
        coverageState: coverageState || undefined,
        verdict: indexStatus?.verdict || undefined,
        pageFetchState,
        robotsTxtState,
      });
    } catch (error: any) {
      console.error('URL Inspection failed for', url, error);
      const reason = error?.errors?.[0]?.message || error?.message || 'Ukendt fejl ved URL Inspection';
      failedUrls.push({ url, reason });
      summary.unknown += 1;
      pages.push({
        url,
        status: 'unknown',
        lastCrawl: null,
        lastInspection: null,
        inspectionFrequency: 'unknown',
        richResults: false,
        history: [],
        coverageState: undefined,
        verdict: undefined,
        pageFetchState: undefined,
        robotsTxtState: undefined,
      });
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`✅ [Indexing API] Completed ${targetUrls.length} inspections in ${elapsed}s`);
  console.log(`📊 [Indexing API] Summary:`, summary);
  console.log(`❌ [Indexing API] Failed: ${failedUrls.length}`);

  const payload: IndexingStatusResponse = {
    summary,
    daily: buildDailyDistribution(startDate, endDate, summary),
    pages,
    inspectedUrls: targetUrls.length,
    failedUrls,
  };

  return NextResponse.json(payload);
}

async function handleRequest(
  request: NextRequest,
  source: 'body' | 'query'
) {
  console.log(`🌐 [Indexing API] Received ${request.method} request (source: ${source})`);
  
  const session = await getServerSession(authOptions);
  if (!session || !(session as any).accessToken) {
    console.error('❌ [Indexing API] Unauthorized - no session or access token');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let siteUrl: string | null = null;
  let startDate: string | null = null;
  let endDate: string | null = null;
  let urls: string[] | undefined;

  if (source === 'body') {
    const body = await request.json();
    siteUrl = body?.siteUrl ?? null;
    startDate = body?.startDate ?? null;
    endDate = body?.endDate ?? null;
    urls = Array.isArray(body?.urls) ? body.urls : undefined;
  } else {
    const params = request.nextUrl.searchParams;
    siteUrl = params.get('site');
    startDate = params.get('startDate');
    endDate = params.get('endDate');
    const queryUrls = params.getAll('url');
    urls = queryUrls.length > 0 ? queryUrls : undefined;
  }

  if (!siteUrl || !startDate || !endDate) {
    return NextResponse.json(
      { error: 'Missing required parameters: siteUrl, startDate, endDate' },
      { status: 400 }
    );
  }

  const oauth2 = new google.auth.OAuth2();
  oauth2.setCredentials({ access_token: (session as any).accessToken });

  try {
    return await inspectUrls(oauth2, siteUrl, startDate, endDate, urls);
  } catch (error: any) {
    console.error('Indexing inspection failed:', error);
    return NextResponse.json(
      { error: error.message || 'Kunne ikke udføre indeks-inspektion.' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return handleRequest(request, 'body');
}

export async function GET(request: NextRequest) {
  return handleRequest(request, 'query');
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}


