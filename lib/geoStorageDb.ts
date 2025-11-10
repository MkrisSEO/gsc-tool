/**
 * GEO Tracking Storage - PostgreSQL database version
 * Replaces the JSON file-based storage with database-backed storage
 */

import prisma from './prisma';

export interface GEOQuery {
  id: string;
  query: string;
  siteUrl: string;
  createdAt: string;
  active: boolean;
  priority: number;
}

export interface GEOTestResult {
  id: string;
  queryId: string;
  engine: 'gemini';
  responseText: string;
  cited: boolean; // Visible citation in response text
  usedAsSource?: boolean; // Found in grounding metadata (used but not visible)
  citationCount: number;
  visibilityScore: number;
  competitors: string[];
  searchQueries?: string[]; // Gemini shows what it searched for
  sourcesFound?: number; // Total web sources found by Gemini (0 = no grounding)
  testedAt: string;
}

/**
 * Get all queries for a site
 */
export async function getQueries(siteUrl: string): Promise<GEOQuery[]> {
  const site = await prisma.site.findUnique({
    where: { siteUrl },
    include: {
      geoQueries: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!site) return [];

  return site.geoQueries.map((q) => ({
    id: q.id,
    query: q.query,
    siteUrl: site.siteUrl,
    active: q.active,
    priority: q.priority,
    createdAt: q.createdAt.toISOString(),
  }));
}

/**
 * Add a new query (thread-safe)
 */
export async function addQuery(
  siteUrl: string,
  query: string,
  priority: number = 1
): Promise<GEOQuery> {
  // Get or create site
  let site = await prisma.site.findUnique({ where: { siteUrl } });
  
  if (!site) {
    // Create with default user
    const user = await prisma.user.findFirst();
    if (!user) {
      throw new Error('No user found. Please run data migration first.');
    }
    
    site = await prisma.site.create({
      data: {
        siteUrl,
        userId: user.id,
        displayName: siteUrl,
      },
    });
  }

  // Create or update query
  const geoQuery = await prisma.gEOQuery.upsert({
    where: {
      siteId_query: {
        siteId: site.id,
        query: query.toLowerCase(),
      },
    },
    create: {
      siteId: site.id,
      query,
      active: true,
      priority,
    },
    update: {
      active: true,
      priority,
    },
  });

  return {
    id: geoQuery.id,
    query: geoQuery.query,
    siteUrl,
    active: geoQuery.active,
    priority: geoQuery.priority,
    createdAt: geoQuery.createdAt.toISOString(),
  };
}

/**
 * Delete a query
 */
export async function deleteQuery(queryId: string): Promise<boolean> {
  try {
    await prisma.gEOQuery.delete({
      where: { id: queryId },
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Save a test result (thread-safe)
 */
export async function saveTestResult(
  result: Omit<GEOTestResult, 'id' | 'testedAt'>
): Promise<GEOTestResult> {
  const dbResult = await prisma.gEOTestResult.create({
    data: {
      queryId: result.queryId,
      engine: result.engine,
      cited: result.cited,
      usedAsSource: result.usedAsSource ?? false,
      citationCount: result.citationCount,
      visibilityScore: result.visibilityScore,
      sourcesFound: result.sourcesFound ?? 0,
      responseText: result.responseText,
      competitors: result.competitors,
      searchQueries: result.searchQueries || null,
    },
  });

  return {
    id: dbResult.id,
    queryId: dbResult.queryId,
    engine: dbResult.engine as 'gemini',
    cited: dbResult.cited,
    usedAsSource: dbResult.usedAsSource,
    citationCount: dbResult.citationCount,
    visibilityScore: dbResult.visibilityScore,
    sourcesFound: dbResult.sourcesFound,
    responseText: dbResult.responseText,
    competitors: dbResult.competitors as string[],
    searchQueries: dbResult.searchQueries as string[] | undefined,
    testedAt: dbResult.testedAt.toISOString(),
  };
}

/**
 * Get test results for a query
 */
export async function getTestResults(
  queryId: string,
  engine?: 'gemini'
): Promise<GEOTestResult[]> {
  const results = await prisma.gEOTestResult.findMany({
    where: {
      queryId,
      ...(engine && { engine }),
    },
    orderBy: { testedAt: 'desc' },
  });

  return results.map((r) => ({
    id: r.id,
    queryId: r.queryId,
    engine: r.engine as 'gemini',
    cited: r.cited,
    usedAsSource: r.usedAsSource,
    citationCount: r.citationCount,
    visibilityScore: r.visibilityScore,
    sourcesFound: r.sourcesFound,
    responseText: r.responseText,
    competitors: r.competitors as string[],
    searchQueries: r.searchQueries as string[] | undefined,
    testedAt: r.testedAt.toISOString(),
  }));
}

/**
 * Get latest test result for each engine for a query
 */
export async function getLatestTestResults(queryId: string): Promise<{
  gemini?: GEOTestResult;
}> {
  const result = await prisma.gEOTestResult.findFirst({
    where: { queryId, engine: 'gemini' },
    orderBy: { testedAt: 'desc' },
  });

  if (!result) return {};

  return {
    gemini: {
      id: result.id,
      queryId: result.queryId,
      engine: 'gemini',
      cited: result.cited,
      usedAsSource: result.usedAsSource,
      citationCount: result.citationCount,
      visibilityScore: result.visibilityScore,
      sourcesFound: result.sourcesFound,
      responseText: result.responseText,
      competitors: result.competitors as string[],
      searchQueries: result.searchQueries as string[] | undefined,
      testedAt: result.testedAt.toISOString(),
    },
  };
}

/**
 * Get all test results for a site (for competitor analysis)
 */
export async function getAllTestResults(siteUrl: string): Promise<GEOTestResult[]> {
  const site = await prisma.site.findUnique({
    where: { siteUrl },
    include: {
      geoQueries: {
        include: {
          testResults: {
            orderBy: { testedAt: 'desc' },
          },
        },
      },
    },
  });

  if (!site) return [];

  const allResults: GEOTestResult[] = [];
  
  for (const query of site.geoQueries) {
    for (const result of query.testResults) {
      allResults.push({
        id: result.id,
        queryId: result.queryId,
        engine: result.engine as 'gemini',
        cited: result.cited,
        usedAsSource: result.usedAsSource,
        citationCount: result.citationCount,
        visibilityScore: result.visibilityScore,
        sourcesFound: result.sourcesFound,
        responseText: result.responseText,
        competitors: result.competitors as string[],
        searchQueries: result.searchQueries as string[] | undefined,
        testedAt: result.testedAt.toISOString(),
      });
    }
  }

  return allResults;
}

/**
 * Get overall stats for a site
 */
export async function getSiteStats(siteUrl: string): Promise<{
  totalQueries: number;
  totalTests: number;
  citationRate: { gemini: number; overall: number };
  usedAsSourceRate: { gemini: number };
  sourcesFoundRate: { gemini: number };
  avgSourcesFound: { gemini: number };
  avgFanOutQueries: { gemini: number };
  topCompetitors: Array<{ domain: string; count: number }>;
}> {
  const site = await prisma.site.findUnique({
    where: { siteUrl },
    include: {
      geoQueries: {
        include: {
          testResults: {
            where: { engine: 'gemini' },
            orderBy: { testedAt: 'desc' },
            take: 1, // Only latest result per query
          },
        },
      },
    },
  });

  if (!site) {
    return {
      totalQueries: 0,
      totalTests: 0,
      citationRate: { gemini: 0, overall: 0 },
      usedAsSourceRate: { gemini: 0 },
      sourcesFoundRate: { gemini: 0 },
      avgSourcesFound: { gemini: 0 },
      avgFanOutQueries: { gemini: 0 },
      topCompetitors: [],
    };
  }

  // Get latest result for each query
  const latestResults = site.geoQueries
    .map((q) => q.testResults[0])
    .filter(Boolean);

  const geminiCited = latestResults.filter((r) => r.cited).length;
  const geminiUsedAsSource = latestResults.filter((r) => r.usedAsSource).length;
  const geminiWithSources = latestResults.filter((r) => r.sourcesFound > 0).length;
  const totalSources = latestResults.reduce((sum, r) => sum + r.sourcesFound, 0);
  const totalFanOuts = latestResults.reduce(
    (sum, r) => sum + ((r.searchQueries as string[] | null)?.length || 0),
    0
  );

  // Count competitor appearances
  const competitorCounts = new Map<string, number>();
  latestResults.forEach((r) => {
    (r.competitors as string[]).forEach((comp) => {
      competitorCounts.set(comp, (competitorCounts.get(comp) || 0) + 1);
    });
  });

  const topCompetitors = Array.from(competitorCounts.entries())
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalQueries: site.geoQueries.length,
    totalTests: latestResults.length,
    citationRate: {
      gemini: latestResults.length > 0 ? (geminiCited / latestResults.length) * 100 : 0,
      overall: latestResults.length > 0 ? (geminiCited / latestResults.length) * 100 : 0,
    },
    usedAsSourceRate: {
      gemini: latestResults.length > 0 ? (geminiUsedAsSource / latestResults.length) * 100 : 0,
    },
    sourcesFoundRate: {
      gemini: latestResults.length > 0 ? (geminiWithSources / latestResults.length) * 100 : 0,
    },
    avgSourcesFound: {
      gemini: latestResults.length > 0 ? totalSources / latestResults.length : 0,
    },
    avgFanOutQueries: {
      gemini: latestResults.length > 0 ? totalFanOuts / latestResults.length : 0,
    },
    topCompetitors,
  };
}

