/**
 * Query Counting Cache and Chunking Utilities
 * Handles intelligent data fetching with chunking for long periods and localStorage caching
 */

interface DateChunk {
  startDate: string;
  endDate: string;
}

interface CachedData {
  data: any[];
  timestamp: number;
  dateRange: { startDate: string; endDate: string };
}

const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const CHUNK_SIZE_DAYS = 7; // 7 days for optimal cache reuse and performance
const ROW_LIMIT = 25000; // GSC API hard limit
const CHUNK_CACHE_PREFIX = 'qc-chunk-'; // Prefix for individual chunk caches

/**
 * Split date range into chunks to avoid hitting API row limits
 */
export function splitDateRangeIntoChunks(
  startDate: string,
  endDate: string,
  chunkSizeDays: number = CHUNK_SIZE_DAYS
): DateChunk[] {
  const chunks: DateChunk[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let currentStart = new Date(start);
  
  while (currentStart < end) {
    const currentEnd = new Date(currentStart);
    currentEnd.setDate(currentEnd.getDate() + chunkSizeDays - 1);
    
    // Don't go past the end date
    const chunkEnd = currentEnd > end ? end : currentEnd;
    
    chunks.push({
      startDate: currentStart.toISOString().split('T')[0],
      endDate: chunkEnd.toISOString().split('T')[0]
    });
    
    // Move to next chunk
    currentStart = new Date(chunkEnd);
    currentStart.setDate(currentStart.getDate() + 1);
  }
  
  return chunks;
}

/**
 * Calculate number of days between two dates
 */
export function getDaysDifference(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}


/**
 * Generate cache key for a single chunk
 */
function getChunkCacheKey(siteUrl: string, startDate: string, endDate: string): string {
  return `${CHUNK_CACHE_PREFIX}${siteUrl}-${startDate}-${endDate}`;
}

/**
 * Get cached chunk data if valid
 */
function getCachedChunk(siteUrl: string, startDate: string, endDate: string): any[] | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cacheKey = getChunkCacheKey(siteUrl, startDate, endDate);
    const cached = localStorage.getItem(cacheKey);
    
    if (!cached) return null;
    
    const parsed: CachedData = JSON.parse(cached);
    const age = Date.now() - parsed.timestamp;
    
    if (age < CACHE_DURATION_MS) {
      return parsed.data;
    } else {
      localStorage.removeItem(cacheKey);
      return null;
    }
  } catch (error) {
    return null;
  }
}

/**
 * Save chunk data to cache
 */
function setCachedChunk(siteUrl: string, startDate: string, endDate: string, data: any[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    const cacheKey = getChunkCacheKey(siteUrl, startDate, endDate);
    const cacheData: CachedData = {
      data,
      timestamp: Date.now(),
      dateRange: { startDate, endDate }
    };
    
    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    // Silently fail for individual chunks - not critical
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      // Clear old chunk caches to make room
      clearOldChunkCaches();
    }
  }
}

/**
 * Clear old chunk caches
 */
function clearOldChunkCaches(): void {
  if (typeof window === 'undefined') return;
  
  try {
    const keys = Object.keys(localStorage);
    const chunkKeys = keys.filter(k => k.startsWith(CHUNK_CACHE_PREFIX));
    
    const cacheEntries = chunkKeys.map(key => {
      try {
        const data = JSON.parse(localStorage.getItem(key) || '{}');
        return { key, timestamp: data.timestamp || 0 };
      } catch {
        return { key, timestamp: 0 };
      }
    }).sort((a, b) => a.timestamp - b.timestamp);
    
    // Remove oldest 50%
    const toRemove = Math.ceil(cacheEntries.length / 2);
    for (let i = 0; i < toRemove; i++) {
      localStorage.removeItem(cacheEntries[i].key);
    }
  } catch (error) {
    // Ignore
  }
}

// Note: Full-dataset caching functions removed - we now use chunk-level caching only
// This avoids localStorage quota issues with large datasets

/**
 * Invalidate cache for specific date range (including all related chunks)
 */
export function invalidateCache(siteUrl: string, startDate: string, endDate: string): void {
  if (typeof window === 'undefined') return;
  
  // Remove all chunk caches that overlap with this date range
  const chunks = splitDateRangeIntoChunks(startDate, endDate);
  let clearedChunks = 0;
  
  chunks.forEach(chunk => {
    const chunkKey = getChunkCacheKey(siteUrl, chunk.startDate, chunk.endDate);
    const removed = localStorage.getItem(chunkKey);
    if (removed) {
      localStorage.removeItem(chunkKey);
      clearedChunks++;
    }
  });
  
  console.log(`✓ Cache invalidated (${clearedChunks} chunks cleared)`);
}

/**
 * Clear all Query Counting chunk caches
 */
export function clearAllCaches(): void {
  if (typeof window === 'undefined') return;
  
  try {
    const keys = Object.keys(localStorage);
    const cacheKeys = keys.filter(k => k.startsWith(CHUNK_CACHE_PREFIX));
    
    cacheKeys.forEach(key => localStorage.removeItem(key));
    console.log(`✓ Cleared all Query Counting chunk caches (${cacheKeys.length} items)`);
  } catch (error) {
    console.warn('Failed to clear all caches:', error);
  }
}

/**
 * Recursively fetch a single chunk, splitting it if it hits the row limit
 */
async function fetchChunkRecursively(
  siteUrl: string,
  startDate: string,
  endDate: string,
  depth: number = 0
): Promise<any[]> {
  const maxDepth = 5; // Prevent infinite recursion
  
  if (depth > maxDepth) {
    console.error(`⚠️ Max recursion depth reached for ${startDate} to ${endDate}`);
    return [];
  }
  
  const response = await fetch('/api/search-console/searchanalytics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      siteUrl,
      startDate,
      endDate,
      dimensions: ['date', 'query'],
      rowLimit: ROW_LIMIT,
    }),
  });
  
  const data = await response.json();
  const rows = data.data?.rows || [];
  
  // If we hit the row limit, split this chunk and recursively fetch
  if (rows.length >= ROW_LIMIT) {
    const daysDiff = getDaysDifference(startDate, endDate);
    
    if (daysDiff <= 1) {
      // Can't split further - single day with >25k rows
      console.warn(`⚠️ Single day (${startDate}) has ${rows.length} rows - data will be incomplete`);
      return rows;
    }
    
    console.warn(`  ⚠️ Hit row limit (${rows.length} rows) for ${startDate} to ${endDate}`);
    console.log(`  → Splitting into smaller chunks (depth: ${depth + 1})...`);
    
    // Split in half
    const midPoint = new Date(startDate);
    const halfDays = Math.floor(daysDiff / 2);
    midPoint.setDate(midPoint.getDate() + halfDays);
    const midDateStr = midPoint.toISOString().split('T')[0];
    
    const nextDay = new Date(midPoint);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayStr = nextDay.toISOString().split('T')[0];
    
    // Recursively fetch both halves
    const [firstHalf, secondHalf] = await Promise.all([
      fetchChunkRecursively(siteUrl, startDate, midDateStr, depth + 1),
      fetchChunkRecursively(siteUrl, nextDayStr, endDate, depth + 1),
    ]);
    
    return [...firstHalf, ...secondHalf];
  }
  
  return rows;
}

/**
 * Fetch Query Counting data with intelligent chunking
 * Automatically splits long date ranges into chunks to avoid API limits
 */
export async function fetchQueryCountingDataWithChunking(
  siteUrl: string,
  startDate: string,
  endDate: string
): Promise<any[]> {
  const daysDiff = getDaysDifference(startDate, endDate);
  
  console.log(`📊 Fetching Query Counting data: ${daysDiff} days`);
  
  // For short periods (single chunk), check chunk cache first
  if (daysDiff <= CHUNK_SIZE_DAYS) {
    console.log('→ Single chunk (short period)');
    
    // Check chunk cache
    const cachedChunk = getCachedChunk(siteUrl, startDate, endDate);
    if (cachedChunk) {
      console.log(`✓ Cached chunk: ${cachedChunk.length} rows (100% cache hit)`);
      return cachedChunk;
    }
    
    console.log('  Fetching single chunk...');
    
    // Fetch with recursive splitting (in case it hits limit)
    const rows = await fetchChunkRecursively(siteUrl, startDate, endDate, 0);
    
    // Cache this chunk
    setCachedChunk(siteUrl, startDate, endDate, rows);
    
    console.log(`✓ Total rows: ${rows.length} (fetched and cached)`);
    return rows;
  }
  
  // For long periods, use chunking with chunk-level caching
  const chunks = splitDateRangeIntoChunks(startDate, endDate);
  console.log(`→ Chunked request (${chunks.length} chunks)`);
  
  let cacheHits = 0;
  let cacheMisses = 0;
  
  // Fetch all chunks in parallel with chunk-level cache checking
  const chunkPromises = chunks.map(async (chunk, index) => {
    try {
      // Check if this specific chunk is cached
      const cachedChunk = getCachedChunk(siteUrl, chunk.startDate, chunk.endDate);
      
      if (cachedChunk) {
        cacheHits++;
        console.log(`  ✓ Chunk ${index + 1}/${chunks.length}: ${cachedChunk.length} rows (cached)`);
        return cachedChunk;
      }
      
      cacheMisses++;
      console.log(`  Fetching chunk ${index + 1}/${chunks.length}: ${chunk.startDate} to ${chunk.endDate}`);
      
      // Use recursive fetching which auto-splits if needed
      const chunkRows = await fetchChunkRecursively(
        siteUrl,
        chunk.startDate,
        chunk.endDate,
        0
      );
      
      console.log(`  ✓ Chunk ${index + 1}/${chunks.length}: ${chunkRows.length} rows (fetched)`);
      
      // Cache this chunk for future use
      setCachedChunk(siteUrl, chunk.startDate, chunk.endDate, chunkRows);
      
      return chunkRows;
    } catch (error) {
      console.error(`  ✗ Chunk ${index + 1}/${chunks.length} failed:`, error);
      return [];
    }
  });
  
  const results = await Promise.all(chunkPromises);
  
  // Merge all results
  const mergedData = results.flat();
  
  const cacheHitRate = chunks.length > 0 ? ((cacheHits / chunks.length) * 100).toFixed(0) : 0;
  console.log(`✓ Total rows: ${mergedData.length} | Cache: ${cacheHits} hits, ${cacheMisses} misses (${cacheHitRate}% hit rate)`);
  
  return mergedData;
}

/**
 * Main function: Get Query Counting data with chunk-level caching and chunking
 * No longer uses full-dataset caching to avoid localStorage quota issues
 */
export async function getQueryCountingData(
  siteUrl: string,
  startDate: string,
  endDate: string,
  forceRefresh: boolean = false
): Promise<any[]> {
  // Fetch data with intelligent chunking (chunk-level caching happens inside)
  const data = await fetchQueryCountingDataWithChunking(siteUrl, startDate, endDate);
  
  return data;
}

