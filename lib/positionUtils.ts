/**
 * Utility functions for processing organic position data
 */

interface PositionDataPoint {
  date: string;
  position1to3: number;
  position4to10: number;
  position11to20: number;
  position21plus: number;
}

/**
 * Process search analytics data to generate position distribution over time
 * Handles deduplication when same query ranks for multiple URLs (uses best position)
 * 
 * @param rows - Raw search analytics data rows with date, query, page (optional), and position
 * @param hasPagDimension - Whether data includes page dimension (for deduplication)
 * @returns Array of position distribution data points
 */
export function processPositionData(rows: any[], hasPageDimension: boolean = false): PositionDataPoint[] {
  // Handle null/undefined/empty input
  if (!rows || rows.length === 0) {
    return [];
  }
  
  // If we have page dimension, we need to deduplicate queries by date
  // and keep only the best (lowest) position for each query per date
  let processedRows = rows;
  
  if (hasPageDimension && rows.length > 0) {
    // Group by date and query, keep best position
    const dateQueryMap = new Map<string, Map<string, any>>();
    
    rows.forEach((row: any) => {
      const date = row.keys[0];
      const query = row.keys[1];
      // page would be in row.keys[2] if dimensions are ['date', 'query', 'page']
      
      // Skip if no date or query
      if (!date || !query) return;
      
      if (!dateQueryMap.has(date)) {
        dateQueryMap.set(date, new Map());
      }
      
      const queryMap = dateQueryMap.get(date)!;
      const existingRow = queryMap.get(query);
      
      // Keep row with best (lowest) position
      if (!existingRow || row.position < existingRow.position) {
        queryMap.set(query, row);
      }
    });
    
    // Flatten back to array
    processedRows = [];
    dateQueryMap.forEach((queryMap) => {
      queryMap.forEach((row) => {
        processedRows.push(row);
      });
    });
    
    console.log(`🔍 [processPositionData] Deduplication: ${rows.length} rows → ${processedRows.length} unique queries`);
  }

  // Group by date and count queries in each position range
  const dateMap = new Map<string, {
    position1to3: number;
    position4to10: number;
    position11to20: number;
    position21plus: number;
  }>();

  processedRows.forEach((row: any) => {
    const date = row.keys[0];
    const position = row.position || 0;

    if (!dateMap.has(date)) {
      dateMap.set(date, {
        position1to3: 0,
        position4to10: 0,
        position11to20: 0,
        position21plus: 0,
      });
    }

    const entry = dateMap.get(date)!;

    // Categorize by position range
    if (position >= 1 && position <= 3) {
      entry.position1to3++;
    } else if (position >= 4 && position <= 10) {
      entry.position4to10++;
    } else if (position >= 11 && position <= 20) {
      entry.position11to20++;
    } else if (position >= 21) {
      entry.position21plus++;
    }
  });

  // Convert to array and sort by date
  const result = Array.from(dateMap.entries())
    .map(([date, data]) => ({
      date,
      ...data,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Debug logging
  if (result.length > 0) {
    console.log(`📊 [processPositionData] Result:`, {
      totalDays: result.length,
      sampleDay: result[0],
      totalQueries: result.reduce((sum, day) => 
        sum + day.position1to3 + day.position4to10 + day.position11to20 + day.position21plus, 0
      ),
    });
  }
  
  return result;
}

/**
 * Process position data for query counting chart
 * This fetches data with query, page, and date dimensions and deduplicates properly
 * 
 * @param rows - Raw GSC data with dimensions ['date', 'query', 'page']
 * @returns Processed position data points
 */
export function processQueryCountingData(rows: any[]): PositionDataPoint[] {
  return processPositionData(rows, true);
}

