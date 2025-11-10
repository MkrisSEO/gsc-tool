import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { google } from 'googleapis';
import { getCachedGSCData, saveGSCDataToCache } from '@/lib/gscDataCache';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session as any).accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { siteUrl, startDate, endDate, dimensions, rowLimit = 1000, dimensionFilterGroups, forceRefresh = false } = body;

    if (!siteUrl || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required parameters: siteUrl, startDate, endDate' },
        { status: 400 }
      );
    }

    // Try cache first (only if no filters - filters make caching complex)
    if (!dimensionFilterGroups && !forceRefresh) {
      const cachedData = await getCachedGSCData(siteUrl, startDate, endDate, dimensions || []);
      
      if (cachedData) {
        console.log(`[GSC API] ✓ Cache hit: ${cachedData.length} rows`);
        
        // Transform cached data to match GSC API format
        const rows = cachedData.map((row) => {
          const keys: string[] = [];
          if (dimensions?.includes('date')) keys.push(row.date);
          if (dimensions?.includes('query') && row.query) keys.push(row.query);
          if (dimensions?.includes('page') && row.page) keys.push(row.page);
          if (dimensions?.includes('country') && row.country) keys.push(row.country);
          if (dimensions?.includes('device') && row.device) keys.push(row.device);
          
          return {
            keys,
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
          };
        });
        
        return NextResponse.json({ data: { rows }, cached: true });
      }
      
      console.log(`[GSC API] ✗ Cache miss, fetching from Google API`);
    }

    const oauth2 = new google.auth.OAuth2();
    oauth2.setCredentials({ access_token: (session as any).accessToken });
    const webmasters = google.webmasters({ version: 'v3', auth: oauth2 });

    const requestBody: any = {
      startDate,
      endDate,
      rowLimit,
    };

    if (dimensions && dimensions.length > 0) {
      requestBody.dimensions = dimensions;
    }

    if (dimensionFilterGroups) {
      requestBody.dimensionFilterGroups = dimensionFilterGroups;
    }

    // Debug logging
    console.log('📤 [GSC API Request]', {
      siteUrl,
      hasDimensions: !!requestBody.dimensions,
      dimensionsList: requestBody.dimensions || [],
      hasFilters: !!requestBody.dimensionFilterGroups,
      filterCount: requestBody.dimensionFilterGroups?.[0]?.filters?.length || 0,
      firstFilter: requestBody.dimensionFilterGroups?.[0]?.filters?.[0],
      receivedFilterGroups: !!dimensionFilterGroups,
    });

    const res = await webmasters.searchanalytics.query({
      siteUrl,
      requestBody,
    });

    console.log('📥 [GSC API Response]', {
      rowsReturned: res.data.rows?.length || 0,
      firstRow: res.data.rows?.[0],
      responseKeys: Object.keys(res.data),
    });

    // Save to cache (only if has date dimension, no filters, and we have data)
    if (!dimensionFilterGroups && res.data.rows && res.data.rows.length > 0 && dimensions?.includes('date')) {
      console.log('[GSC API] Preparing to save to cache:', {
        rows: res.data.rows.length,
        dimensions: dimensions,
        siteUrl,
      });

      const dataToCache = res.data.rows.map((row: any) => {
        const dataPoint: any = {
          clicks: row.clicks,
          impressions: row.impressions,
          ctr: row.ctr,
          position: row.position,
        };

        // Map dimensions to fields
        dimensions?.forEach((dim: string, index: number) => {
          if (dim === 'date') dataPoint.date = row.keys[index];
          if (dim === 'query') dataPoint.query = row.keys[index];
          if (dim === 'page') dataPoint.page = row.keys[index];
          if (dim === 'country') dataPoint.country = row.keys[index];
          if (dim === 'device') dataPoint.device = row.keys[index];
        });

        return dataPoint;
      });

      console.log('[GSC API] Sample data to cache:', dataToCache[0]);

      // Try to save synchronously to catch errors
      try {
        const saveResult = await saveGSCDataToCache(siteUrl, dataToCache);
        console.log('[GSC API] Cache save result:', saveResult);
        return NextResponse.json({ 
          data: res.data, 
          cached: false,
          cacheSaved: saveResult.success,
          cacheErrors: saveResult.errors.length > 0 ? saveResult.errors : undefined
        });
      } catch (cacheError: any) {
        console.error('[GSC API] ✗ Cache save error:', cacheError);
        return NextResponse.json({ 
          data: res.data, 
          cached: false,
          cacheSaved: false,
          cacheError: cacheError.message 
        });
      }
    } else if (!dimensions?.includes('date')) {
      console.log('[GSC API] Skipping cache - no date dimension');
    }

    return NextResponse.json({ data: res.data, cached: false, cacheSaved: false });
  } catch (error: any) {
    console.error('Error fetching search analytics:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch search analytics' },
      { status: 500 }
    );
  }
}

