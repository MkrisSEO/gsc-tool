/**
 * GEO Tracking Storage - JSON file-based storage
 */

import fs from 'fs/promises';
import path from 'path';

const GEO_DATA_FILE = path.join(process.cwd(), 'data', 'geo-tracking.json');

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

interface GEOData {
  queries: GEOQuery[];
  results: GEOTestResult[];
}

/**
 * Load GEO data from JSON file
 */
async function loadGeoData(): Promise<GEOData> {
  try {
    const content = await fs.readFile(GEO_DATA_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // File doesn't exist yet, return empty structure
    return { queries: [], results: [] };
  }
}

// Lock mechanism for concurrent write protection
let writeLock: Promise<void> = Promise.resolve();

/**
 * Save GEO data to JSON file with write lock to prevent race conditions
 */
async function saveGeoData(data: GEOData): Promise<void> {
  // Wait for any pending writes to complete
  await writeLock;
  
  // Create new lock
  writeLock = (async () => {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    try {
      await fs.mkdir(dataDir, { recursive: true });
    } catch (e) {
      // Directory already exists
    }
    
    await fs.writeFile(GEO_DATA_FILE, JSON.stringify(data, null, 2));
  })();
  
  await writeLock;
}

/**
 * Get all queries for a site
 */
export async function getQueries(siteUrl: string): Promise<GEOQuery[]> {
  const data = await loadGeoData();
  return data.queries.filter(q => q.siteUrl === siteUrl);
}

/**
 * Add a new query (thread-safe with reload before save)
 */
export async function addQuery(
  siteUrl: string,
  query: string,
  priority: number = 1
): Promise<GEOQuery> {
  // Wait for lock
  await writeLock;
  
  // Reload fresh data to avoid race conditions
  const data = await loadGeoData();
  
  // Check if query already exists for this site
  const exists = data.queries.find(
    q => q.siteUrl === siteUrl && q.query.toLowerCase() === query.toLowerCase()
  );
  
  if (exists) {
    return exists;
  }
  
  const newQuery: GEOQuery = {
    id: `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    query,
    siteUrl,
    createdAt: new Date().toISOString(),
    active: true,
    priority,
  };
  
  data.queries.push(newQuery);
  await saveGeoData(data);
  
  return newQuery;
}

/**
 * Delete a query
 */
export async function deleteQuery(queryId: string): Promise<boolean> {
  const data = await loadGeoData();
  
  const index = data.queries.findIndex(q => q.id === queryId);
  if (index === -1) return false;
  
  data.queries.splice(index, 1);
  
  // Also delete all results for this query
  data.results = data.results.filter(r => r.queryId !== queryId);
  
  await saveGeoData(data);
  return true;
}

/**
 * Save a test result (thread-safe with reload before save)
 */
export async function saveTestResult(result: Omit<GEOTestResult, 'id' | 'testedAt'>): Promise<GEOTestResult> {
  // Wait for lock
  await writeLock;
  
  // Reload fresh data to avoid race conditions
  const data = await loadGeoData();
  
  const newResult: GEOTestResult = {
    ...result,
    id: `r_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    testedAt: new Date().toISOString(),
  };
  
  data.results.push(newResult);
  await saveGeoData(data);
  
  return newResult;
}

/**
 * Get test results for a query
 */
export async function getTestResults(
  queryId: string,
  engine?: 'gemini'
): Promise<GEOTestResult[]> {
  const data = await loadGeoData();
  
  let results = data.results.filter(r => r.queryId === queryId);
  
  if (engine) {
    results = results.filter(r => r.engine === engine);
  }
  
  // Sort by most recent first
  results.sort((a, b) => new Date(b.testedAt).getTime() - new Date(a.testedAt).getTime());
  
  return results;
}

/**
 * Get latest test result for each engine for a query
 */
export async function getLatestTestResults(queryId: string): Promise<{
  gemini?: GEOTestResult;
}> {
  const data = await loadGeoData();
  
  const queryResults = data.results.filter(r => r.queryId === queryId);
  queryResults.sort((a, b) => new Date(b.testedAt).getTime() - new Date(a.testedAt).getTime());
  
  const gemini = queryResults.find(r => r.engine === 'gemini');
  
  return { gemini };
}

/**
 * Get all test results for a site (for competitor analysis)
 */
export async function getAllTestResults(siteUrl: string): Promise<GEOTestResult[]> {
  const data = await loadGeoData();
  
  const siteQueries = data.queries.filter(q => q.siteUrl === siteUrl);
  const queryIds = siteQueries.map(q => q.id);
  const siteResults = data.results.filter(r => queryIds.includes(r.queryId));
  
  return siteResults;
}

/**
 * Get overall stats for a site
 */
export async function getSiteStats(siteUrl: string): Promise<{
  totalQueries: number;
  totalTests: number;
  citationRate: { gemini: number; overall: number };
  usedAsSourceRate: { gemini: number }; // How often Gemini uses your site in grounding
  sourcesFoundRate: { gemini: number }; // How often Gemini finds ANY sources at all
  avgSourcesFound: { gemini: number }; // Average number of sources found per query
  avgFanOutQueries: { gemini: number }; // Average fan-out queries generated
  topCompetitors: Array<{ domain: string; count: number }>;
}> {
  const data = await loadGeoData();
  
  const siteQueries = data.queries.filter(q => q.siteUrl === siteUrl);
  const queryIds = siteQueries.map(q => q.id);
  const siteResults = data.results.filter(r => queryIds.includes(r.queryId));
  
  // Calculate citation rates (visible citations)
  const geminiTests = siteResults.filter(r => r.engine === 'gemini');
  const geminiCited = geminiTests.filter(r => r.cited).length;
  
  // Calculate "used as source" rate (in grounding, even if not visible)
  const geminiUsedAsSource = geminiTests.filter(r => r.usedAsSource).length;
  
  // Calculate sources found metrics
  const geminiWithSources = geminiTests.filter(r => (r.sourcesFound ?? 0) > 0).length;
  const totalSources = geminiTests.reduce((sum, r) => sum + (r.sourcesFound ?? 0), 0);
  const avgSources = geminiTests.length > 0 ? totalSources / geminiTests.length : 0;
  
  // Calculate fan-out metrics
  const totalFanOuts = geminiTests.reduce((sum, r) => sum + (r.searchQueries?.length ?? 0), 0);
  const avgFanOuts = geminiTests.length > 0 ? totalFanOuts / geminiTests.length : 0;
  
  const geminiRate = geminiTests.length > 0 ? (geminiCited / geminiTests.length) * 100 : 0;
  const geminiUsedRate = geminiTests.length > 0 ? (geminiUsedAsSource / geminiTests.length) * 100 : 0;
  const geminiSourcesRate = geminiTests.length > 0 ? (geminiWithSources / geminiTests.length) * 100 : 0;
  const overallRate = siteResults.length > 0 
    ? (geminiCited / siteResults.length) * 100 
    : 0;
  
  // Count competitor appearances
  const competitorCounts = new Map<string, number>();
  siteResults.forEach(r => {
    r.competitors.forEach(comp => {
      competitorCounts.set(comp, (competitorCounts.get(comp) || 0) + 1);
    });
  });
  
  const topCompetitors = Array.from(competitorCounts.entries())
    .map(([domain, count]) => ({ domain, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  return {
    totalQueries: siteQueries.length,
    totalTests: siteResults.length,
    citationRate: {
      gemini: geminiRate,
      overall: overallRate,
    },
    usedAsSourceRate: {
      gemini: geminiUsedRate,
    },
    sourcesFoundRate: {
      gemini: geminiSourcesRate,
    },
    avgSourcesFound: {
      gemini: avgSources,
    },
    avgFanOutQueries: {
      gemini: avgFanOuts,
    },
    topCompetitors,
  };
}

