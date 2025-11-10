// @ts-nocheck
import { google } from 'googleapis';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';

type IndexingStatus = 'submitted_indexed' | 'crawled_not_indexed' | 'discovered_not_indexed' | 'unknown';

interface InspectionResult {
  url: string;
  status: IndexingStatus;
  lastCrawl: string | null;
  richResults: boolean;
  lastInspection: string | null;
  inspectionFrequency: string;
  coverageState?: string;
  verdict?: string;
  pageFetchState?: string;
  robotsTxtState?: string;
  crawlAllowedState?: string;
  indexingAllowedState?: string;
  userCanonical?: string;
  googleCanonical?: string;
}

const DAY_IN_MS = 1000 * 60 * 60 * 24;

function classifyStatus(coverageState?: string | null, verdict?: string | null): IndexingStatus {
  if (!coverageState) return 'unknown';
  
  const normalized = coverageState.toLowerCase();
  const verdictNormalized = (verdict || '').toLowerCase();
  
  // INDEXED - Pages that are successfully indexed
  if (normalized.includes('submitted_and_indexed') || 
      normalized.includes('indexed_not_submitted') ||
      (normalized.includes('indexed') && !normalized.includes('not indexed'))) {
    return 'submitted_indexed';
  }
  
  // CRAWLED BUT NOT INDEXED - Pages that were crawled but excluded for various reasons
  if (normalized.includes('crawled') ||
      normalized.includes('excluded_by_noindex') ||
      normalized.includes('page_with_redirect') ||
      normalized.includes('not_found') ||
      normalized.includes('duplicate') ||
      normalized.includes('blocked_by_robots') ||
      normalized.includes('soft_404') ||
      normalized.includes('blocked') ||
      normalized.includes('alternate_page_with_proper_canonical') ||
      verdictNormalized.includes('fail') ||
      verdictNormalized.includes('excluded')) {
    return 'crawled_not_indexed';
  }
  
  // DISCOVERED BUT NOT INDEXED - Pages Google knows about but hasn't crawled yet
  if (normalized.includes('discovered') ||
      normalized.includes('found_but_not_crawled') ||
      normalized.includes('registered')) {
    return 'discovered_not_indexed';
  }
  
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

export async function POST(request: NextRequest) {
  console.log('🔍 [URL Inspection] Received request');

  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session as any).accessToken) {
      console.error('❌ [URL Inspection] Unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteUrl, url } = body || {};

    if (!siteUrl || !url) {
      return NextResponse.json(
        { error: 'Missing required parameters: siteUrl, url' },
        { status: 400 }
      );
    }

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: (session as any).accessToken });
    const searchconsole = google.searchconsole({ version: 'v1', auth: oauth2 });

    console.log(`🔎 [URL Inspection] Inspecting: ${url}`);
    const startTime = Date.now();

    const response = await searchconsole.urlInspection.index.inspect({
      requestBody: {
        inspectionUrl: url,
        siteUrl,
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ [URL Inspection] Completed in ${elapsed}s`);

    const result = response.data?.inspectionResult;
    const indexStatus = result?.indexStatusResult;
    const coverageState = indexStatus?.coverageState || null;
    const verdict = indexStatus?.verdict || null;
    const status = classifyStatus(coverageState, verdict);

    console.log(`🔍 [URL Inspection] ${url} -> Coverage: ${coverageState}, Verdict: ${verdict}, Status: ${status}`);

    const lastCrawl = indexStatus?.lastCrawlTime || null;
    const richResultsVerdict = result?.richResultsResult?.verdict || null;
    const pageFetchState = indexStatus?.pageFetchState;
    const robotsTxtState = indexStatus?.robotsTxtState;
    const crawlAllowedState = indexStatus?.crawlAllowedState;
    const indexingAllowedState = indexStatus?.indexingState;
    const userCanonical = indexStatus?.userCanonical;
    const googleCanonical = indexStatus?.googleCanonical;

    const inspectionResult: InspectionResult = {
      url,
      status,
      lastCrawl,
      lastInspection: lastCrawl,
      inspectionFrequency: formatInspectionFrequency(lastCrawl),
      richResults: richResultsVerdict === 'VERDICT_PASS',
      coverageState: coverageState || undefined,
      verdict: indexStatus?.verdict || undefined,
      pageFetchState,
      robotsTxtState,
      crawlAllowedState,
      indexingAllowedState,
      userCanonical,
      googleCanonical,
    };

    return NextResponse.json(inspectionResult);
  } catch (error: any) {
    console.error('❌ [URL Inspection] Error:', error);
    return NextResponse.json(
      { 
        error: error.message || 'Failed to inspect URL',
        details: error?.errors?.[0]?.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}

