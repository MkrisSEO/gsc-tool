'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import MetricsCards from '@/components/MetricsCards';
import PerformanceChart, { Annotation, GoogleUpdate } from '@/components/PerformanceChart';
import AdvancedDateRangeSelector from '@/components/AdvancedDateRangeSelector';
import OrganicPositionsChart from '@/components/OrganicPositionsChart';
import AnnotationModal, { AnnotationFormData } from '@/components/AnnotationModal';
import GA4MetricsCards from '@/components/GA4MetricsCards';
import SourceBreakdownChart from '@/components/SourceBreakdownChart';
import CacheStatusBadge from '@/components/CacheStatusBadge';
import { processPositionData } from '@/lib/positionUtils';

interface QueryRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

interface UrlRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [compareRange, setCompareRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState({
    totalClicks: { value: 0 },
    totalImpressions: { value: 0 },
    top1to3Keywords: { value: 0 },
    top4to10Keywords: { value: 0 },
    top20to30Keywords: { value: 0 },
    ctr: { value: 0 },
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [compareChartData, setCompareChartData] = useState<any[]>([]);
  const [topQueries, setTopQueries] = useState<QueryRow[]>([]);
  const [topUrls, setTopUrls] = useState<UrlRow[]>([]);
  const [rawTopUrls, setRawTopUrls] = useState<UrlRow[]>([]); // ✅ Store unfiltered URLs for Content Groups table
  const [compareQueries, setCompareQueries] = useState<QueryRow[]>([]);
  const [compareUrls, setCompareUrls] = useState<UrlRow[]>([]);
  const [rawCompareUrls, setRawCompareUrls] = useState<UrlRow[]>([]); // ✅ Store unfiltered comparison URLs
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['clicks', 'impressions', 'ctr', 'position']);
  const [selectedQuery, setSelectedQuery] = useState<string | null>(null);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [queryUrls, setQueryUrls] = useState<UrlRow[]>([]);
  const [queryCompareUrls, setQueryCompareUrls] = useState<UrlRow[]>([]);
  const [positionData, setPositionData] = useState<any[]>([]);
  const [comparePositionData, setComparePositionData] = useState<any[]>([]);
  const [queryCountingLoading, setQueryCountingLoading] = useState(false);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [selectedAnnotationDate, setSelectedAnnotationDate] = useState<string | null>(null);
  const [googleUpdates, setGoogleUpdates] = useState<GoogleUpdate[]>([]);
  const [selectedContentGroupId, setSelectedContentGroupId] = useState<string | null>(null);
  const [contentGroupUrls, setContentGroupUrls] = useState<string[]>([]);
  const [contentGroups, setContentGroups] = useState<Array<{
    id: string;
    name: string;
    siteUrl: string;
    urlCount: number;
    matchedUrls: string[];
  }>>([]);

  // Cache Status State
  const [cacheStatus, setCacheStatus] = useState<{
    cached: boolean;
    count: number;
  }>({ cached: false, count: 0 });

  // GA4 State
  const [ga4PropertyId, setGA4PropertyId] = useState<string | null>(null);
  const [ga4PropertyName, setGA4PropertyName] = useState<string | null>(null);
  const [showGA4Data, setShowGA4Data] = useState(false);
  const [ga4Loading, setGA4Loading] = useState(false);
  const [ga4DebugInfo, setGA4DebugInfo] = useState<{
    searchedDomain?: string;
    availableProperties?: Array<{
      propertyId: string;
      propertyName: string;
      websiteUrl: string;
      accountName: string;
    }>;
    reason?: string;
    errorDetails?: string;
    errorCode?: string;
  } | null>(null);
  const [ga4Data, setGA4Data] = useState<{
    total: {
      sessions: number;
      users: number;
      bounceRate: number;
      avgDuration: number;
    };
    bySource: Array<{
      source: string;
      sessions: number;
      users: number;
      bounceRate: number;
      avgDuration: number;
      percentage: number;
    }>;
    comparison?: {
      total: {
        sessions: number;
        users: number;
        sessionsDelta: number;
        sessionsPercentChange: number;
        usersDelta: number;
        usersPercentChange: number;
      };
    };
  } | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    } else if (status === 'authenticated') {
      const site = searchParams.get('site');
      if (!site) {
        router.push('/properties');
      } else {
        setSelectedSite(site);
      }
    }
  }, [status, router, searchParams]);

  useEffect(() => {
    if (selectedContentGroupId && selectedSite) {
      fetchContentGroupUrls();
    } else {
      setContentGroupUrls([]);
    }
  }, [selectedContentGroupId, selectedSite]);

  useEffect(() => {
    if (selectedSite) {
      fetchContentGroups();
    }
  }, [selectedSite]);

  useEffect(() => {
    if (!selectedSite || !dateRange.startDate || !dateRange.endDate) return;
    
    // ✅ CHANGED: We now fetch ALL data and filter in frontend
    // So we wait for contentGroupUrls to load before fetching
    if (selectedContentGroupId && contentGroupUrls.length === 0) {
      console.log('⏳ Waiting for content group URLs to load...');
      return;
    }
    
    fetchData();
    fetchAnnotations();
    fetchGoogleUpdates();
  }, [selectedSite, dateRange, compareRange, selectedQuery, selectedUrl, selectedContentGroupId, contentGroupUrls]);

  const fetchContentGroups = async () => {
    if (!selectedSite) return;

    try {
      const response = await fetch(`/api/content-groups?siteUrl=${encodeURIComponent(selectedSite)}`);
      const json = await response.json();
      
      if (response.ok && json.groups) {
        setContentGroups(json.groups);
      }
    } catch (error) {
      console.error('Failed to fetch content groups:', error);
      setContentGroups([]);
    }
  };

  const fetchContentGroupUrls = async () => {
    if (!selectedContentGroupId || !selectedSite) {
      setContentGroupUrls([]);
      return;
    }

    try {
      const response = await fetch(`/api/content-groups?id=${selectedContentGroupId}`);
      const json = await response.json();
      
      if (response.ok && json.group) {
        setContentGroupUrls(json.group.matchedUrls || []);
      }
    } catch (error) {
      console.error('Failed to fetch content group URLs:', error);
      setContentGroupUrls([]);
    }
  };

  const fetchAnnotations = async () => {
    if (!selectedSite) return;

    try {
      const response = await fetch(`/api/annotations?siteUrl=${encodeURIComponent(selectedSite)}`);
      const json = await response.json();
      if (response.ok && json.annotations) {
        setAnnotations(json.annotations);
      }
    } catch (error) {
      console.error('Failed to fetch annotations:', error);
    }
  };

  const fetchGoogleUpdates = async () => {
    if (!dateRange.startDate || !dateRange.endDate) return;

    try {
      const url = new URL('/api/google-updates', window.location.origin);
      url.searchParams.set('startDate', dateRange.startDate);
      url.searchParams.set('endDate', dateRange.endDate);
      
      const response = await fetch(url.toString());
      const json = await response.json();
      
      if (response.ok && json.updates) {
        setGoogleUpdates(json.updates);
      }
    } catch (error) {
      console.error('Failed to fetch Google updates:', error);
    }
  };

  // GA4 Functions
  const detectGA4Property = async () => {
    if (!selectedSite) return;

    try {
      const response = await fetch('/api/analytics/detect-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteUrl: selectedSite }),
      });

      const result = await response.json();

      if (result.matched && result.property) {
        console.log('✅ GA4 property detected:', result.property);
        setGA4PropertyId(result.property.propertyId);
        setGA4PropertyName(result.property.propertyName);
        setShowGA4Data(true);
        setGA4DebugInfo(null);
      } else {
        console.log('ℹ️ No GA4 property found for this site');
        console.log('Debug info:', result);
        setShowGA4Data(false);
        setGA4PropertyId(null);
        setGA4PropertyName(null);
        setGA4DebugInfo({
          searchedDomain: result.searchedDomain,
          availableProperties: result.availableProperties,
          reason: result.reason,
          errorDetails: result.errorDetails,
          errorCode: result.errorCode,
        });
      }
    } catch (error) {
      console.error('Failed to detect GA4 property:', error);
      setShowGA4Data(false);
    }
  };

  const fetchGA4Data = async () => {
    if (!ga4PropertyId || !dateRange.startDate || !dateRange.endDate) return;

    setGA4Loading(true);
    try {
      const response = await fetch('/api/analytics/organic-traffic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: ga4PropertyId,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          compareStartDate: compareRange?.startDate,
          compareEndDate: compareRange?.endDate,
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        setGA4Data(result.data);
        console.log('✅ GA4 data loaded:', result.data.total.sessions, 'sessions');
      } else {
        console.warn('Failed to fetch GA4 data:', result.error);
        setGA4Data(null);
      }
    } catch (error) {
      console.error('Failed to fetch GA4 data:', error);
      setGA4Data(null);
    } finally {
      setGA4Loading(false);
    }
  };

  // Manual property selection
  const selectGA4Property = (propertyId: string, propertyName: string) => {
    console.log('✅ Manually selected GA4 property:', propertyName);
    setGA4PropertyId(propertyId);
    setGA4PropertyName(propertyName);
    setShowGA4Data(true);
    setGA4DebugInfo(null);
  };

  // Detect GA4 property when site is selected
  useEffect(() => {
    if (selectedSite) {
      detectGA4Property();
    }
  }, [selectedSite]);

  // Fetch GA4 data when property is detected and date range changes
  useEffect(() => {
    if (ga4PropertyId && dateRange.startDate && dateRange.endDate) {
      fetchGA4Data();
    }
  }, [ga4PropertyId, dateRange, compareRange]);

  // Compute content groups with data from RAW unfiltered URLs
  const contentGroupsWithData = useMemo(() => {
    if (!contentGroups.length || !rawTopUrls.length) return []; // ✅ Use rawTopUrls (unfiltered)
    
    const normalizeUrl = (url: string | undefined) => {
      if (!url) return ''; // Handle undefined/null URLs gracefully
      return url.toLowerCase().replace(/\/$/, '');
    };
    
    return contentGroups.map(group => {
      // Find all URLs for this group in rawTopUrls
      const normalizedGroupUrls = group.matchedUrls.map(normalizeUrl).filter(u => u !== '');
      
      const groupUrlRows = rawTopUrls.filter(row => 
        row.keys[0] && normalizedGroupUrls.includes(normalizeUrl(row.keys[0]))
      );
      
      // Find comparison URLs if compare data exists
      const compareGroupUrlRows = rawCompareUrls.filter(row =>
        row.keys[0] && normalizedGroupUrls.includes(normalizeUrl(row.keys[0]))
      );
      
      // Aggregate current period
      const current = groupUrlRows.reduce((acc, row) => ({
        clicks: acc.clicks + row.clicks,
        impressions: acc.impressions + row.impressions,
        position: acc.position + row.position,
        count: acc.count + 1,
      }), { clicks: 0, impressions: 0, position: 0, count: 0 });
      
      // Aggregate compare period
      const compare = compareGroupUrlRows.reduce((acc, row) => ({
        clicks: acc.clicks + row.clicks,
        impressions: acc.impressions + row.impressions,
        position: acc.position + row.position,
        count: acc.count + 1,
      }), { clicks: 0, impressions: 0, position: 0, count: 0 });
      
      const getChangePercent = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return ((curr - prev) / prev) * 100;
      };
      
      const currentCtr = current.impressions > 0 ? current.clicks / current.impressions : 0;
      const compareCtr = compare.impressions > 0 ? compare.clicks / compare.impressions : 0;
      const currentPos = current.count > 0 ? current.position / current.count : 0;
      const comparePos = compare.count > 0 ? compare.position / compare.count : 0;
      
      return {
        id: group.id,
        name: group.name,
        urlCount: group.urlCount,
        clicks: current.clicks,
        impressions: current.impressions,
        ctr: currentCtr,
        position: currentPos,
        clicksChange: compare.count > 0 ? getChangePercent(current.clicks, compare.clicks) : undefined,
        impressionsChange: compare.count > 0 ? getChangePercent(current.impressions, compare.impressions) : undefined,
        ctrChange: compare.count > 0 ? getChangePercent(currentCtr, compareCtr) : undefined,
        positionChange: compare.count > 0 ? getChangePercent(currentPos, comparePos) : undefined,
      };
    }).sort((a, b) => b.clicks - a.clicks);
  }, [contentGroups, rawTopUrls, rawCompareUrls]); // ✅ Changed dependencies to raw URLs

  const handleCreateAnnotation = async (formData: AnnotationFormData) => {
    try {
      const response = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          siteUrl: selectedSite,
        }),
      });

      const json = await response.json();
      
      if (response.ok && json.annotation) {
        setAnnotations([...annotations, json.annotation]);
        setShowAnnotationModal(false);
        setSelectedAnnotationDate(null);
        alert('✅ Annotation created successfully!');
      } else {
        throw new Error(json.error || 'Failed to create annotation');
      }
    } catch (error) {
      console.error('Failed to create annotation:', error);
      alert('❌ Failed to create annotation: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDateClick = (date: string) => {
    setSelectedAnnotationDate(date);
    setShowAnnotationModal(true);
  };

  const handleDeleteAnnotation = async (annotationId: string) => {
    if (!confirm('Are you sure you want to delete this annotation?')) {
      return;
    }

    try {
      const response = await fetch(`/api/annotations?id=${annotationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAnnotations(annotations.filter((a) => a.id !== annotationId));
        alert('✅ Annotation deleted');
      } else {
        const json = await response.json();
        throw new Error(json.error || 'Failed to delete annotation');
      }
    } catch (error) {
      console.error('Failed to delete annotation:', error);
      alert('❌ Failed to delete: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  // Set default date range (last 28 days) - This will be handled by AdvancedDateRangeSelector
  useEffect(() => {
    // Default will be set by the AdvancedDateRangeSelector component
  }, []);

  // Sync all dashboard data from Google API to database
  const handleRefreshData = async () => {
    if (!selectedSite) return;

    setSyncing(true);
    setError(null);

    try {
      console.log('[Refresh] Starting data sync...');

      // Call both sync endpoints in parallel
      const [dashboardSync, queryCountingSync] = await Promise.all([
        fetch('/api/sync/dashboard-data', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl: selectedSite }),
        }),
        fetch('/api/sync/query-counting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ siteUrl: selectedSite }),
        }),
      ]);

      if (!dashboardSync.ok || !queryCountingSync.ok) {
        throw new Error('Sync failed');
      }

      const dashboardResult = await dashboardSync.json();
      const queryCountingResult = await queryCountingSync.json();

      console.log('[Refresh] ✅ Dashboard data synced:', dashboardResult);
      console.log('[Refresh] ✅ Query counting synced:', queryCountingResult);
      
      // 🔧 FALLBACK: If Query Counting has 0 days, try re-aggregating from existing data
      if (queryCountingResult.aggregatedDays === 0) {
        console.log('[Refresh] ⚠️ No Query Counting aggregates, trying re-aggregation...');
        try {
          const reaggregateRes = await fetch('/api/sync/reaggregate-query-counting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ siteUrl: selectedSite }),
          });
          
          if (reaggregateRes.ok) {
            const reaggregateResult = await reaggregateRes.json();
            console.log('[Refresh] ✅ Re-aggregation successful:', reaggregateResult);
          } else {
            console.log('[Refresh] ⚠️ Re-aggregation failed - raw data may not exist yet');
          }
        } catch (reaggErr) {
          console.log('[Refresh] ⚠️ Re-aggregation error:', reaggErr);
        }
      }

      // Refresh the dashboard
      await fetchData();

      // Success message could be added here if desired
    } catch (err: any) {
      console.error('[Refresh] Error:', err);
      setError(`Failed to sync data: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const fetchData = async () => {
    if (!selectedSite || !dateRange.startDate || !dateRange.endDate) return;

    // Don't clear existing data - just set loading state
    // This prevents the UI from "blinking" when switching filters
    const perfStart = performance.now();
    const perfTimings: any = {}; // Move outside try block
    
    setLoading(true);
    setError(null);

    try {
      console.log('⏱️ [Performance] Dashboard load started...');
      
      // 🔥 Time series dimensions: Just date + page for performance chart
      // Query Counting will be calculated from queries data when filtered
      const timeSeriesDimensions = ['date', 'page'];
      const queryPageDimensions = selectedQuery ? ['query', 'page'] : ['page'];
      
      // ⚠️ REMOVED: dimensionFilterGroups
      // We now use 100% frontend filtering for content groups
      // This avoids JSON serialization issues with large filter arrays
      
      console.log('🔍 [fetchData] Fetch Strategy:', {
        selectedContentGroupId,
        contentGroupUrlsCount: contentGroupUrls.length,
        filteringStrategy: selectedContentGroupId ? 'Frontend filtering (post-fetch)' : 'No filtering',
        sampleUrls: contentGroupUrls.slice(0, 3),
        timeSeriesDimensions,
      });
      
      const fetchStart = performance.now();
      const [timeSeriesRes, queriesRes, urlsRes, queryPageRes] = await Promise.all([
        fetch('/api/search-console/searchanalytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteUrl: selectedSite,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            dimensions: timeSeriesDimensions,
            // NO dimensionFilterGroups - we filter in frontend
            rowLimit: 25000,  // ✅ Increased to get all date-page combinations
          }),
        }),
        fetch('/api/search-console/searchanalytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteUrl: selectedSite,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            dimensions: ['query', 'page'],  // ✅ Added 'page' dimension for frontend filtering
            // NO dimensionFilterGroups - we filter in frontend
            rowLimit: 25000,  // Increased to capture all query-page combinations
          }),
        }),
        fetch('/api/search-console/searchanalytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteUrl: selectedSite,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            dimensions: ['page'],
            // NO dimensionFilterGroups - we filter in frontend
            rowLimit: 25000,  // Max limit to get ALL URLs
          }),
        }),
        selectedQuery ? fetch('/api/search-console/searchanalytics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteUrl: selectedSite,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            dimensions: queryPageDimensions,
            // NO dimensionFilterGroups - we filter in frontend
            rowLimit: 1000,
          }),
        }) : Promise.resolve({ json: async () => ({ data: { rows: [] } }) }),
      ]);

      const [timeSeriesData, queriesData, urlsData, queryPageData] = await Promise.all([
        timeSeriesRes.json(),
        queriesRes.json(),
        urlsRes.json(),
        queryPageRes.json(),
      ]);
      
      perfTimings.apiCalls = ((performance.now() - fetchStart) / 1000).toFixed(2) + 's';
      console.log(`⏱️ [Performance] API calls completed in ${perfTimings.apiCalls}`);
      
      // Get all data (no limits)
      const timeSeriesRows = (timeSeriesData.data?.rows || []) as any[];
      const isLargeSite = timeSeriesRows.length > 10000;
      
      if (isLargeSite) {
        console.log(`⚡ [Performance] Large site detected (${timeSeriesRows.length} URLs)`);
      }

      // 🔍 Debug: Log full response structure
      console.log('🔍 [API Response Debug]:', {
        timeSeriesKeys: Object.keys(timeSeriesData),
        timeSeriesProps: {
          cached: timeSeriesData.cached,
          cacheSaved: timeSeriesData.cacheSaved,
          cacheError: timeSeriesData.cacheError,
          hasData: !!timeSeriesData.data,
          rowCount: timeSeriesData.data?.rows?.length,
        },
        queriesProps: {
          cached: queriesData.cached,
          cacheSaved: queriesData.cacheSaved,
          cacheError: queriesData.cacheError,
        },
      });

      // 💾 Log cache status
      const cachedCount = [timeSeriesData.cached, queriesData.cached, urlsData.cached, queryPageData.cached].filter(Boolean).length;
      const allCached = cachedCount === 4 || (cachedCount === 3 && !selectedQuery);
      
      console.log('💾 [Database Cache Status]:', {
        timeSeries: timeSeriesData.cached ? '✅ CACHED' : '❌ API Call',
        queries: queriesData.cached ? '✅ CACHED' : '❌ API Call',
        urls: urlsData.cached ? '✅ CACHED' : '❌ API Call',
        queryPage: queryPageData.cached ? '✅ CACHED' : '❌ API Call',
      });

      // Log cache save status
      console.log('💾 [Cache Save Status]:', {
        timeSeries: timeSeriesData.cacheSaved ? '✅ Saved' : '❌ Not saved',
        queries: queriesData.cacheSaved ? '✅ Saved' : '❌ Not saved',
        urls: urlsData.cacheSaved ? '✅ Saved' : '❌ Not saved',
      });

      // Log cache save errors if any
      if (timeSeriesData.cacheError) console.error('❌ Cache save error (timeSeries):', timeSeriesData.cacheError);
      if (timeSeriesData.cacheErrors) console.error('❌ Cache insert errors (timeSeries):', timeSeriesData.cacheErrors);
      if (queriesData.cacheError) console.error('❌ Cache save error (queries):', queriesData.cacheError);
      if (queriesData.cacheErrors) console.error('❌ Cache insert errors (queries):', queriesData.cacheErrors);
      if (urlsData.cacheError) console.error('❌ Cache save error (urls):', urlsData.cacheError);
      if (urlsData.cacheErrors) console.error('❌ Cache insert errors (urls):', urlsData.cacheErrors);
      if (queryPageData.cacheError) console.error('❌ Cache save error (queryPage):', queryPageData.cacheError);

      setCacheStatus({ cached: allCached, count: cachedCount });

      if (timeSeriesData.error) throw new Error(timeSeriesData.error);
      if (queriesData.error) throw new Error(queriesData.error);

      // 🔥 FRONTEND FILTERING HELPER
      const normalizeUrl = (url: string | undefined) => {
        if (!url) return ''; // Handle undefined/null URLs gracefully
        return url.toLowerCase().replace(/\/$/, '');
      };
      const isUrlInContentGroup = (url: string | undefined) => {
        if (!url) return false; // If no URL, exclude from content group
        if (!selectedContentGroupId || contentGroupUrls.length === 0) return true; // No filter = include all
        const normalizedGroupUrls = contentGroupUrls.map(normalizeUrl);
        return normalizedGroupUrls.includes(normalizeUrl(url));
      };

      // Process time series data
      let rows = timeSeriesData.data?.rows || [];
      
      console.log('📊 [Time Series] Raw data:', {
        totalRows: rows.length,
        sampleRow: rows[0],
        dimensions: timeSeriesDimensions,
      });
      
      // 🔥 Filter by content group (page is in keys[1] with ['date', 'page'])
      // OPTIMIZED: Use Set for O(1) lookups instead of O(n) array.some
      if (selectedContentGroupId && contentGroupUrls.length > 0) {
        const filterStart = performance.now();
        
        // Build normalized URL Set once (instead of normalizing on every row)
        const normalizedUrlSet = new Set(contentGroupUrls.map(url => normalizeUrl(url)));
        
        rows = rows.filter((row: any) => {
          const pageUrl = row.keys[1];
          if (!pageUrl) return false;
          return normalizedUrlSet.has(normalizeUrl(pageUrl));
        });
        
        const filterTime = ((performance.now() - filterStart) / 1000).toFixed(2);
        perfTimings.contentGroupFilter = filterTime + 's';
        
        console.log('🔥 [Time Series] After content group filter:', {
          filteredRows: rows.length,
          filterTime: filterTime + 's',
          sampleFiltered: rows.slice(0, 3).map((r: any) => ({ date: r.keys[0], page: r.keys[1], clicks: r.clicks })),
        });
      }
      
      // If URL is selected, filter by that URL (page is in keys[1])
      if (selectedUrl) {
        rows = rows.filter((row: any) => row.keys[1] === selectedUrl);
        console.log('🔥 [Time Series] After URL filter:', {
          filteredRows: rows.length,
          selectedUrl,
        });
      }
      
      // Group by date and aggregate (simple aggregation for ['date', 'page'])
      const dateMap = new Map<string, any>();
      
      rows.forEach((row: any) => {
        const date = row.keys[0];
        if (!dateMap.has(date)) {
          dateMap.set(date, { date, clicks: 0, impressions: 0, position: 0, count: 0 });
        }
        const entry = dateMap.get(date)!;
        entry.clicks += row.clicks || 0;
        entry.impressions += row.impressions || 0;
        entry.position += row.position || 0;
        entry.count += 1;
      });
      
      const processedChartData = Array.from(dateMap.values()).map((entry) => ({
        date: entry.date,
        clicks: entry.clicks,
        impressions: entry.impressions,
        ctr: entry.impressions > 0 ? entry.clicks / entry.impressions : 0,
        position: entry.count > 0 ? entry.position / entry.count : 0,
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setChartData(processedChartData);
      
      // 🔥 Filter and aggregate queries by content group or URL (if selected)
      let queryRows = (queriesData.data?.rows || []) as any[];
      
      // Filter by selected URL first (most specific)
      if (selectedUrl) {
        queryRows = queryRows.filter((row: any) => row.keys[1] === selectedUrl);
        console.log('🔥 [Frontend Filter] Queries after URL filter:', {
          originalCount: (queriesData.data?.rows || []).length,
          filteredCount: queryRows.length,
          selectedUrl,
        });
      } else if (selectedContentGroupId && contentGroupUrls.length > 0) {
        // Filter rows by content group URLs (page is in keys[1])
        // OPTIMIZED: Use Set for O(1) lookups
        const filterStart = performance.now();
        const normalizedUrlSet = new Set(contentGroupUrls.map(url => normalizeUrl(url)));
        
        queryRows = queryRows.filter((row: any) => {
          const pageUrl = row.keys[1];
          if (!pageUrl) return false;
          return normalizedUrlSet.has(normalizeUrl(pageUrl));
        });
        
        const filterTime = ((performance.now() - filterStart) / 1000).toFixed(2);
        perfTimings.queriesFilter = filterTime + 's';
        
        console.log('🔥 [Frontend Filter] Queries after content group filter:', {
          originalCount: (queriesData.data?.rows || []).length,
          filteredCount: queryRows.length,
          filterTime: filterTime + 's',
          sampleFiltered: queryRows.slice(0, 3).map((r: any) => ({ query: r.keys[0], page: r.keys[1], clicks: r.clicks })),
        });
      }
      
      // Aggregate by query (since we have query-page pairs)
      const queryMap = new Map<string, { clicks: number; impressions: number; position: number; count: number }>();
      queryRows.forEach((row: any) => {
        const query = row.keys[0];
        if (!queryMap.has(query)) {
          queryMap.set(query, { clicks: 0, impressions: 0, position: 0, count: 0 });
        }
        const entry = queryMap.get(query)!;
        entry.clicks += row.clicks || 0;
        entry.impressions += row.impressions || 0;
        entry.position += row.position || 0;
        entry.count += 1;
      });
      
      queryRows = Array.from(queryMap.entries()).map(([query, data]) => ({
        keys: [query],
        clicks: data.clicks,
        impressions: data.impressions,
        ctr: data.impressions > 0 ? data.clicks / data.impressions : 0,
        position: data.count > 0 ? data.position / data.count : 0,
      })).sort((a, b) => b.clicks - a.clicks);
      
      setTopQueries(queryRows.slice(0, 100) as QueryRow[]);
      
      // 📊 Fetch/Calculate Query Counting data for position distribution
      setQueryCountingLoading(true);
      
      let calculatedTop1to3 = 0;
      let calculatedTop4to10 = 0;
      let calculatedTop20to30 = 0;
      
      try {
        // ✅ If URL or content group filter is active, fetch detailed data for Query Counting chart
        if (selectedUrl || selectedContentGroupId) {
          console.log('📊 [Query Counting] Fetching detailed data for filtered chart...');
          
          // Fetch ['date', 'query', 'page'] to enable filtering and time series
          const qcDetailedRes = await fetch('/api/search-console/searchanalytics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              siteUrl: selectedSite,
              startDate: dateRange.startDate,
              endDate: dateRange.endDate,
              dimensions: ['date', 'query', 'page'],
              rowLimit: 25000,
            }),
          });
          
          const qcDetailedData = await qcDetailedRes.json();
          let qcRows = qcDetailedData.data?.rows || [];
          
          // Filter by URL or Content Group
          const qcFilterStart = performance.now();
          
          if (selectedUrl) {
            qcRows = qcRows.filter((row: any) => row.keys[2] === selectedUrl);
          } else if (selectedContentGroupId && contentGroupUrls.length > 0) {
            // OPTIMIZED: Use Set for O(1) lookups
            const normalizedUrlSet = new Set(contentGroupUrls.map(url => normalizeUrl(url)));
            qcRows = qcRows.filter((row: any) => {
              const pageUrl = row.keys[2];
              if (!pageUrl) return false;
              return normalizedUrlSet.has(normalizeUrl(pageUrl));
            });
          }
          
          const qcFilterTime = ((performance.now() - qcFilterStart) / 1000).toFixed(2);
          perfTimings.queryCountingFilter = qcFilterTime + 's';
          
          console.log('📊 [Query Counting] Filtered data:', {
            totalRows: qcRows.length,
            filterTime: qcFilterTime + 's',
            filter: selectedUrl ? `URL: ${selectedUrl}` : `Content Group (${contentGroupUrls.length} URLs)`,
          });
          
          // Process to position data over time
          const processedPositionData = processPositionData(qcRows, true);
          setPositionData(processedPositionData);
          
          // Calculate metrics from latest day
          if (!selectedQuery && processedPositionData.length > 0) {
            const latestDay = processedPositionData[processedPositionData.length - 1];
            calculatedTop1to3 = latestDay.position1to3;
            calculatedTop4to10 = latestDay.position4to10;
            calculatedTop20to30 = Math.round(latestDay.position11to20 * 0.5);
            
            console.log('📊 [Metrics] Using filtered Query Counting data:', {
              top1to3: calculatedTop1to3,
              top4to10: calculatedTop4to10,
              top20to30: calculatedTop20to30,
              days: processedPositionData.length,
            });
          }
        } else {
          // No filter - use pre-aggregated data from database
          console.log('📊 [Query Counting] Fetching from database cache...');
          const startTime = performance.now();
          
          const qcResponse = await fetch('/api/query-counting', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              siteUrl: selectedSite,
              startDate: dateRange.startDate,
              endDate: dateRange.endDate,
              forceRefresh: false,
            }),
          });

          const qcData = await qcResponse.json();
          const fetchTime = performance.now() - startTime;
          
          // Check if we got pre-aggregated data or raw rows
          if (qcData.positionData) {
            // Pre-aggregated from database - use directly!
            console.log('📊 [Query Counting] Pre-aggregated data loaded:', {
              cached: '✅ FROM CACHE (AGGREGATED)',
              days: qcData.positionData.length,
              fetchTimeMs: Math.round(fetchTime),
              sample: qcData.positionData[0],
            });
            setPositionData(qcData.positionData);
            
            // Calculate metrics from latest day
            if (qcData.positionData.length > 0 && !selectedQuery) {
              const latestDay = qcData.positionData[qcData.positionData.length - 1];
              calculatedTop1to3 = latestDay.position1to3;
              calculatedTop4to10 = latestDay.position4to10;
              calculatedTop20to30 = Math.round(latestDay.position11to20 * 0.5);
              
              console.log('📊 [Metrics] Using Query Counting data:', {
                top1to3: calculatedTop1to3,
                top4to10: calculatedTop4to10,
                top20to30: calculatedTop20to30,
              });
            }
          } else {
            // Raw rows from API - process client-side
            const queryCountingRows = qcData.rows || [];
            console.log('📊 [Query Counting] Raw data loaded:', {
              cached: qcData.cached ? '✅ FROM CACHE' : '❌ FROM API',
              totalRows: queryCountingRows.length,
              fetchTimeMs: Math.round(fetchTime),
            });
            
            const processedPositionData = processPositionData(queryCountingRows, false);
            setPositionData(processedPositionData);
            
            // Calculate metrics from latest day
            if (processedPositionData.length > 0 && !selectedQuery) {
              const latestDay = processedPositionData[processedPositionData.length - 1];
              calculatedTop1to3 = latestDay.position1to3;
              calculatedTop4to10 = latestDay.position4to10;
              calculatedTop20to30 = Math.round(latestDay.position11to20 * 0.5);
            }
          }
        }
        
      } catch (err) {
        console.error('Failed to fetch Query Counting data:', err);
        setPositionData([]);
      } finally {
        setQueryCountingLoading(false);
      }
      
      // If query is selected, fetch URLs for that query
      if (selectedQuery && queryPageData.data?.rows) {
        const queryPageRows = (queryPageData.data.rows || []).filter((row: any) => row.keys[0] === selectedQuery);
        const urlRows = queryPageRows.map((row: any) => ({
          keys: [row.keys[1]], // URL is in keys[1]
          clicks: row.clicks || 0,
          impressions: row.impressions || 0,
          ctr: row.ctr || 0,
          position: row.position || 0,
        })) as UrlRow[];
        setQueryUrls(urlRows);
      } else {
        setQueryUrls([]);
      }

      // 🔥 Filter URLs by content group (if selected)
      let filteredUrlRows: UrlRow[] = [];
      if (!urlsData.error) {
        let urlRows = (urlsData.data?.rows || []) as UrlRow[];
        
        // ✅ Sort all URLs by clicks first
        urlRows = urlRows.sort((a, b) => b.clicks - a.clicks);
        
        // ✅ Always store raw unfiltered URLs for Content Groups table
        setRawTopUrls(urlRows);
        
        if (selectedContentGroupId && contentGroupUrls.length > 0) {
          // OPTIMIZED: Use Set for O(1) lookups
          const filterStart = performance.now();
          const normalizedUrlSet = new Set(contentGroupUrls.map(url => normalizeUrl(url)));
          
          urlRows = urlRows.filter((row: UrlRow) => {
            const pageUrl = row.keys[0];
            if (!pageUrl) return false;
            return normalizedUrlSet.has(normalizeUrl(pageUrl));
          });
          
          const filterTime = ((performance.now() - filterStart) / 1000).toFixed(2);
          perfTimings.urlsFilter = filterTime + 's';
          
          console.log('🔥 [Frontend Filter] URLs after content group filter:', {
            originalCount: (urlsData.data?.rows || []).length,
            filteredCount: urlRows.length,
            filterTime: filterTime + 's',
          });
        }
        
        filteredUrlRows = urlRows;
        setTopUrls(urlRows); // Filtered URLs for Top URLs table (already sorted by clicks)
      }

      // 🔥 Calculate totals from FILTERED URLs (most accurate for content groups)
      // URLs give us complete metrics across ALL queries, not just top queries
      const totals = filteredUrlRows.reduce(
        (acc: any, row: any) => ({
          clicks: acc.clicks + (row.clicks || 0),
          impressions: acc.impressions + (row.impressions || 0),
        }),
        { clicks: 0, impressions: 0 }
      );
      
      console.log('📊 [Metrics Calculation]', {
        source: 'filtered URLs',
        urlCount: filteredUrlRows.length,
        totalClicks: totals.clicks,
        totalImpressions: totals.impressions,
        hasContentGroupFilter: !!selectedContentGroupId,
        contentGroupUrlsCount: contentGroupUrls.length,
      });

      // Fetch comparison period data if compareRange is set
      let comparisonData = null;
      if (compareRange) {
        try {
          // ✅ Initialize comparison metrics at the top of the comparison block
          let compareTop1to3 = 0;
          let compareTop4to10 = 0;
          let compareTop20to30 = 0;
          
          // 🔥 Simple dimensions matching main data fetch
          const compareTimeSeriesDimensions = ['date', 'page'];
          const compareQueryPageDimensions = selectedQuery ? ['query', 'page'] : ['page'];
          
          const [compareTimeSeriesRes, compareQueriesRes, compareUrlsRes, compareQueryPageRes] = await Promise.all([
            fetch('/api/search-console/searchanalytics', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                siteUrl: selectedSite,
                startDate: compareRange.startDate,
                endDate: compareRange.endDate,
                dimensions: compareTimeSeriesDimensions,
                // NO dimensionFilterGroups - we filter in frontend
                rowLimit: 25000,  // ✅ Increased to get all date-page combinations
              }),
            }),
            fetch('/api/search-console/searchanalytics', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                siteUrl: selectedSite,
                startDate: compareRange.startDate,
                endDate: compareRange.endDate,
                dimensions: ['query', 'page'],  // ✅ Added 'page' dimension for frontend filtering
                // NO dimensionFilterGroups - we filter in frontend
                rowLimit: 25000,  // Increased to capture all query-page combinations
              }),
            }),
            fetch('/api/search-console/searchanalytics', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                siteUrl: selectedSite,
                startDate: compareRange.startDate,
                endDate: compareRange.endDate,
                dimensions: ['page'],
                // NO dimensionFilterGroups - we filter in frontend
                rowLimit: 25000,  // Max limit to get ALL URLs
              }),
            }),
            selectedQuery ? fetch('/api/search-console/searchanalytics', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                siteUrl: selectedSite,
                startDate: compareRange.startDate,
                endDate: compareRange.endDate,
                dimensions: compareQueryPageDimensions,
                // NO dimensionFilterGroups - we filter in frontend
                rowLimit: 1000,
              }),
            }) : Promise.resolve({ json: async () => ({ data: { rows: [] } }) }),
          ]);

          const [compareTimeSeriesData, compareQueriesData, compareUrlsData, compareQueryPageData] = await Promise.all([
            compareTimeSeriesRes.json(),
            compareQueriesRes.json(),
            compareUrlsRes.json(),
            compareQueryPageRes.json(),
          ]);

          if (!compareTimeSeriesData.error && !compareQueriesData.error) {
            let compareRows = compareTimeSeriesData.data?.rows || [];
            let compareQueryRows = (compareQueriesData.data?.rows || []) as any[];
            
            // 🔥 Filter by content group (page is in keys[1] with ['date', 'page'])
            // OPTIMIZED: Use Set for O(1) lookups
            if (selectedContentGroupId && contentGroupUrls.length > 0) {
              const normalizedUrlSet = new Set(contentGroupUrls.map(url => normalizeUrl(url)));
              compareRows = compareRows.filter((row: any) => {
                const pageUrl = row.keys[1];
                if (!pageUrl) return false;
                return normalizedUrlSet.has(normalizeUrl(pageUrl));
              });
            }
            
            // If URL is selected, filter by that URL (page is in keys[1])
            if (selectedUrl) {
              compareRows = compareRows.filter((row: any) => row.keys[1] === selectedUrl);
            }
            
            // Group by date and aggregate (simple for ['date', 'page'])
            const compareDateMap = new Map<string, any>();
            compareRows.forEach((row: any) => {
              const date = row.keys[0];
              if (!compareDateMap.has(date)) {
                compareDateMap.set(date, { date, clicks: 0, impressions: 0, position: 0, count: 0 });
              }
              const entry = compareDateMap.get(date)!;
              entry.clicks += row.clicks || 0;
              entry.impressions += row.impressions || 0;
              entry.position += row.position || 0;
              entry.count += 1;
            });
            
            const compareProcessedChartData = Array.from(compareDateMap.values()).map((entry) => ({
              date: entry.date,
              clicks: entry.clicks,
              impressions: entry.impressions,
              ctr: entry.impressions > 0 ? entry.clicks / entry.impressions : 0,
              position: entry.count > 0 ? entry.position / entry.count : 0,
            })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            setCompareChartData(compareProcessedChartData);
            
            // ✅ Fetch comparison Query Counting (separate API call or calculate from queries)
            if (selectedUrl || selectedContentGroupId) {
              // Calculate from filtered comparison queries
              if (!selectedQuery && compareQueryRows.length > 0) {
                compareTop1to3 = compareQueryRows.filter((q: any) => q.position >= 1 && q.position <= 3).length;
                compareTop4to10 = compareQueryRows.filter((q: any) => q.position >= 4 && q.position <= 10).length;
                compareTop20to30 = compareQueryRows.filter((q: any) => q.position >= 20 && q.position <= 30).length;
                
                console.log('📊 [Comparison Metrics] Using filtered comparison queries:', {
                  compareTop1to3,
                  compareTop4to10,
                  compareTop20to30,
                });
              }
              setComparePositionData([]); // No chart for filtered comparison
            } else {
              // No filter - fetch from database
              try {
                console.log('📊 [Comparison Query Counting] Fetching from database via API...');
                
                const compareQcResponse = await fetch('/api/query-counting', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    siteUrl: selectedSite,
                    startDate: compareRange.startDate,
                    endDate: compareRange.endDate,
                    forceRefresh: false,
                  }),
                });

                const compareQcData = await compareQcResponse.json();
                
                if (compareQcData.positionData) {
                  // Pre-aggregated from database
                  setComparePositionData(compareQcData.positionData);
                  
                  // ✅ Calculate comparison metrics from latest day
                  if (compareQcData.positionData.length > 0 && !selectedQuery) {
                    const latestCompareDay = compareQcData.positionData[compareQcData.positionData.length - 1];
                    compareTop1to3 = latestCompareDay.position1to3;
                    compareTop4to10 = latestCompareDay.position4to10;
                    compareTop20to30 = Math.round(latestCompareDay.position11to20 * 0.5);
                    
                    console.log('📊 [Comparison Metrics] Using Query Counting data:', {
                      compareTop1to3,
                      compareTop4to10,
                      compareTop20to30,
                    });
                  }
                } else {
                  // Fallback: process raw rows
                  const compareQueryCountingRows = compareQcData.rows || [];
                  const compareProcessedPositionData = processPositionData(compareQueryCountingRows, false);
                  setComparePositionData(compareProcessedPositionData);
                  
                  if (compareProcessedPositionData.length > 0 && !selectedQuery) {
                    const latestCompareDay = compareProcessedPositionData[compareProcessedPositionData.length - 1];
                    compareTop1to3 = latestCompareDay.position1to3;
                    compareTop4to10 = latestCompareDay.position4to10;
                    compareTop20to30 = Math.round(latestCompareDay.position11to20 * 0.5);
                  }
                }
              } catch (err) {
                console.error('Failed to fetch comparison Query Counting data:', err);
                setComparePositionData([]);
              }
            }
            
            // If query is selected, fetch comparison URLs for that query
            if (selectedQuery && compareQueryPageData.data?.rows) {
              const compareQueryPageRows = (compareQueryPageData.data.rows || []).filter((row: any) => row.keys[0] === selectedQuery);
              const compareUrlRows = compareQueryPageRows.map((row: any) => ({
                keys: [row.keys[1]], // URL is in keys[1]
                clicks: row.clicks || 0,
                impressions: row.impressions || 0,
                ctr: row.ctr || 0,
                position: row.position || 0,
              })) as UrlRow[];
              setQueryCompareUrls(compareUrlRows);
            } else {
              setQueryCompareUrls([]);
            }

            // 🔥 Filter and aggregate comparison queries by URL, content group (if selected)
            // Note: compareQueryRows already defined above at line 1013
            
            // Filter by selected URL first (most specific)
            if (selectedUrl) {
              compareQueryRows = compareQueryRows.filter((row: any) => row.keys[1] === selectedUrl);
            } else if (selectedContentGroupId && contentGroupUrls.length > 0) {
              // Filter rows by content group URLs (page is in keys[1])
              // OPTIMIZED: Use Set for O(1) lookups
              const normalizedUrlSet = new Set(contentGroupUrls.map(url => normalizeUrl(url)));
              compareQueryRows = compareQueryRows.filter((row: any) => {
                const pageUrl = row.keys[1];
                if (!pageUrl) return false;
                return normalizedUrlSet.has(normalizeUrl(pageUrl));
              });
            }
            
            // Aggregate by query (since we have query-page pairs)
            const compareQueryMap = new Map<string, { clicks: number; impressions: number; position: number; count: number }>();
            compareQueryRows.forEach((row: any) => {
              const query = row.keys[0];
              if (!compareQueryMap.has(query)) {
                compareQueryMap.set(query, { clicks: 0, impressions: 0, position: 0, count: 0 });
              }
              const entry = compareQueryMap.get(query)!;
              entry.clicks += row.clicks || 0;
              entry.impressions += row.impressions || 0;
              entry.position += row.position || 0;
              entry.count += 1;
            });
            
            compareQueryRows = Array.from(compareQueryMap.entries()).map(([query, data]) => ({
              keys: [query],
              clicks: data.clicks,
              impressions: data.impressions,
              ctr: data.impressions > 0 ? data.clicks / data.impressions : 0,
              position: data.count > 0 ? data.position / data.count : 0,
            })).sort((a, b) => b.clicks - a.clicks);
            
            setCompareQueries(compareQueryRows as QueryRow[]);

            // 🔥 Filter comparison URLs by content group (if selected)
            let filteredCompareUrlRows: UrlRow[] = [];
            if (!compareUrlsData.error) {
              let compareUrlRows = (compareUrlsData.data?.rows || []) as UrlRow[];
              
              // ✅ Sort comparison URLs by clicks
              compareUrlRows = compareUrlRows.sort((a, b) => b.clicks - a.clicks);
              
              // ✅ Always store raw unfiltered comparison URLs for Content Groups table
              setRawCompareUrls(compareUrlRows);
              
              if (selectedContentGroupId && contentGroupUrls.length > 0) {
                compareUrlRows = compareUrlRows.filter((row: UrlRow) => isUrlInContentGroup(row.keys[0]));
              }
              
              filteredCompareUrlRows = compareUrlRows;
              setCompareUrls(compareUrlRows); // Filtered URLs for comparison (already sorted)
            }

            // 🔥 Calculate comparison totals from FILTERED URLs (most accurate)
            const compareTotals = filteredCompareUrlRows.reduce(
              (acc: any, row: any) => ({
                clicks: acc.clicks + (row.clicks || 0),
                impressions: acc.impressions + (row.impressions || 0),
              }),
              { clicks: 0, impressions: 0 }
            );

            comparisonData = {
              clicks: compareTotals.clicks,
              impressions: compareTotals.impressions,
              top1to3: compareTop1to3,
              top4to10: compareTop4to10,
              top20to30: compareTop20to30,
            };
          }
        } catch (compareErr) {
          console.warn('Failed to fetch comparison data:', compareErr);
        }
      } else {
        setCompareChartData([]);
        setCompareQueries([]);
        setCompareUrls([]);
        setComparePositionData([]);
      }

      // Calculate changes
      const calculateChange = (current: number, previous: number) => {
        if (previous === 0) return { change: current, changePercent: current > 0 ? 100 : 0 };
        const change = current - previous;
        const changePercent = (change / previous) * 100;
        return { change, changePercent };
      };

      const clicksChange = comparisonData 
        ? calculateChange(totals.clicks, comparisonData.clicks)
        : {};
      const impressionsChange = comparisonData
        ? calculateChange(totals.impressions, comparisonData.impressions)
        : {};
      const top1to3Change = comparisonData
        ? calculateChange(calculatedTop1to3, comparisonData.top1to3)
        : {};
      const top4to10Change = comparisonData
        ? calculateChange(calculatedTop4to10, comparisonData.top4to10)
        : {};
      const top20to30Change = comparisonData
        ? calculateChange(calculatedTop20to30, comparisonData.top20to30)
        : {};

      const currentCtr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
      const previousCtr = comparisonData && comparisonData.impressions > 0
        ? (comparisonData.clicks / comparisonData.impressions) * 100
        : 0;
      const ctrChange = comparisonData
        ? calculateChange(currentCtr, previousCtr)
        : {};

      setMetrics({
        totalClicks: { value: totals.clicks, ...clicksChange },
        totalImpressions: { value: totals.impressions, ...impressionsChange },
        top1to3Keywords: { value: calculatedTop1to3, ...top1to3Change },
        top4to10Keywords: { value: calculatedTop4to10, ...top4to10Change },
        top20to30Keywords: { value: calculatedTop20to30, ...top20to30Change },
        ctr: { value: currentCtr, ...ctrChange },
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
      console.error('Error fetching data:', err);
    } finally {
      const perfEnd = performance.now();
      const totalTime = ((perfEnd - perfStart) / 1000).toFixed(2);
      console.log(`⏱️ [Performance] Dashboard loaded in ${totalTime}s`);
      console.log(`⏱️ [Performance] Breakdown:`, perfTimings);
      
      // Warning for slow loads
      if (parseFloat(totalTime) > 10) {
        console.warn(`⚠️ [Performance] Slow load detected (${totalTime}s) - Consider optimizations for large sites`);
      }
      
      setLoading(false);
    }
  };

  if (status === 'loading') {
    return (
      <main style={{ padding: 24 }}>
        <div>Loading...</div>
      </main>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <main style={{ padding: 32, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <button
              onClick={() => router.push('/properties')}
              className="btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              ← Change Site
            </button>
            <CacheStatusBadge cached={cacheStatus.cached} label="Dashboard" />
          </div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: '#FFFFFF' }}>Dashboard</h1>
          <p style={{ margin: '8px 0 0', color: 'rgba(255, 255, 255, 0.7)' }}>
            {selectedSite}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }}>{session.user?.email}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="btn-danger"
          >
            Sign Out
          </button>
        </div>
      </div>

      {selectedSite && (
        <>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 16, 
            marginBottom: 24,
            flexWrap: 'wrap'
          }}>
            <AdvancedDateRangeSelector
              dateRange={dateRange}
              compareRange={compareRange}
              onDateChange={(startDate, endDate) => {
                setDateRange({ startDate, endDate });
              }}
              onCompareChange={(range) => {
                setCompareRange(range);
              }}
            />
            {dateRange.startDate && dateRange.endDate && (
              <button
                onClick={handleRefreshData}
                disabled={syncing}
                className="btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                  opacity: syncing ? 0.6 : 1,
                  cursor: syncing ? 'not-allowed' : 'pointer',
                }}
                title="Sync all dashboard data from Google Search Console"
              >
                {syncing ? '⏳ Syncing...' : '🔄 Refresh All Data'}
              </button>
            )}
          </div>
        </>
      )}

      {error && (
        <div
          style={{
            padding: 16,
            background: '#ffeef0',
            color: '#d00',
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          Error: {error}
        </div>
      )}

      {selectedSite && (
        <div style={{ position: 'relative' }}>
          {loading && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(255, 255, 255, 0.85)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                backdropFilter: 'blur(2px)',
              }}
            >
              <div
                style={{
                  padding: '20px 32px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    border: '3px solid #e5e7eb',
                    borderTop: '3px solid #2563eb',
                    borderRadius: '50%',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                <span style={{ fontSize: 14, fontWeight: 500 }}>
                  {selectedContentGroupId ? 'Loading filtered data...' : 'Loading data...'}
                </span>
              </div>
            </div>
          )}
          
          <>
          <MetricsCards {...metrics} />
          
          {(selectedQuery || selectedUrl || selectedContentGroupId) && (
            <div style={{ marginBottom: 16, marginTop: 24, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selectedQuery && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(37, 99, 235, 0.15)', border: '1px solid rgba(37, 99, 235, 0.3)', borderRadius: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#3B8FF3' }}>
                    Query: {selectedQuery}
                  </span>
                  <button
                    onClick={() => setSelectedQuery(null)}
                    style={{
                      padding: '2px 6px',
                      fontSize: 12,
                      background: 'transparent',
                      border: 'none',
                      color: '#3B8FF3',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              
              {selectedUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.3)', borderRadius: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#A855F7' }}>
                    URL: {selectedUrl.length > 50 ? selectedUrl.substring(0, 50) + '...' : selectedUrl}
                  </span>
                  <button
                    onClick={() => setSelectedUrl(null)}
                    style={{
                      padding: '2px 6px',
                      fontSize: 12,
                      background: 'transparent',
                      border: 'none',
                      color: '#A855F7',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
              
              {selectedContentGroupId && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#51CF66' }}>
                    Group: {contentGroups.find(g => g.id === selectedContentGroupId)?.name || contentGroupsWithData.find(g => g.id === selectedContentGroupId)?.name || 'Unknown'}
                  </span>
                  <button
                    onClick={() => setSelectedContentGroupId(null)}
                    style={{
                      padding: '2px 6px',
                      fontSize: 12,
                      background: 'transparent',
                      border: 'none',
                      color: '#51CF66',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    ×
                  </button>
                </div>
              )}
            </div>
          )}

          <PerformanceChart
            data={chartData}
            compareData={compareRange ? compareChartData : undefined}
            selectedMetrics={selectedMetrics}
            dateRange={dateRange}
            compareRange={compareRange}
            annotations={annotations}
            googleUpdates={googleUpdates}
            onDateClick={handleDateClick}
            onDeleteAnnotation={handleDeleteAnnotation}
            siteUrl={selectedSite}
            metricCheckboxes={
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {[
                  { key: 'clicks', label: 'Clicks', color: '#2563eb' },
                  { key: 'impressions', label: 'Impressions', color: '#7c3aed' },
                  { key: 'ctr', label: 'CTR', color: '#059669' },
                  { key: 'position', label: 'Position', color: '#ea580c' },
                ].map((metric) => (
                  <label
                    key={metric.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      cursor: 'pointer',
                      padding: '8px 12px',
                      background: selectedMetrics.includes(metric.key as any) ? 'rgba(0, 113, 227, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                      border: `1px solid ${selectedMetrics.includes(metric.key as any) ? 'rgba(0, 113, 227, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                      borderRadius: 10,
                      transition: 'all 0.2s',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMetrics.includes(metric.key as any)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMetrics([...selectedMetrics, metric.key as any]);
                        } else {
                          setSelectedMetrics(selectedMetrics.filter(m => m !== metric.key));
                        }
                      }}
                      style={{ cursor: 'pointer', width: 16, height: 16 }}
                    />
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        background: metric.color,
                        borderRadius: 3,
                      }}
                    />
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#FFFFFF' }}>
                      {metric.label}
                    </span>
                  </label>
                ))}
              </div>
            }
          />

          <AnnotationModal
            isOpen={showAnnotationModal}
            selectedDate={selectedAnnotationDate}
            onClose={() => {
              setShowAnnotationModal(false);
              setSelectedAnnotationDate(null);
            }}
            onSave={handleCreateAnnotation}
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 24, marginTop: 32 }}>
            <div>
              <h2 style={{ marginBottom: 16, fontSize: 22, fontWeight: 700, color: '#FFFFFF' }}>Top Queries</h2>
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  maxHeight: 500,
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0, 113, 227, 0.08)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', width: '40%' }}>
                        Query
                      </th>
                      <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', width: '15%' }}>
                        Clicks
                      </th>
                      <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', width: '15%' }}>
                        Impr.
                      </th>
                      <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', width: '15%' }}>
                        CTR
                      </th>
                      <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', width: '15%' }}>
                        Pos.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {topQueries.map((row, idx) => {
                      const compareRow = compareQueries.find((cq) => cq.keys[0] === row.keys[0]);
                      const getChangePercent = (current: number, previous: number) => {
                        if (previous === 0) return current > 0 ? 100 : 0;
                        return ((current - previous) / previous) * 100;
                      };
                      const clicksChange = compareRow ? getChangePercent(row.clicks, compareRow.clicks) : null;
                      const impressionsChange = compareRow ? getChangePercent(row.impressions, compareRow.impressions) : null;
                      const ctrChange = compareRow ? getChangePercent(row.ctr, compareRow.ctr) : null;
                      const positionChange = compareRow ? getChangePercent(row.position, compareRow.position) : null;
                      
                      const formatChange = (change: number | null) => {
                        if (change === null) return null;
                        const isPositive = change > 0;
                        const sign = isPositive ? '+' : '';
                        return (
                          <div style={{ fontSize: 11, color: isPositive ? '#059669' : '#dc2626', marginTop: 2 }}>
                            {sign}{change.toFixed(1)}%
                          </div>
                        );
                      };

                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                            cursor: 'pointer',
                            background: selectedQuery === row.keys[0] ? '#eff6ff' : 'transparent',
                          }}
                          onClick={() => setSelectedQuery(row.keys[0])}
                        >
                          <td style={{ padding: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.keys[0]}</td>
                          <td style={{ padding: 12, textAlign: 'right', color: 'rgba(255, 255, 255, 0.9)' }}>
                            <div>{row.clicks.toLocaleString()}</div>
                            {formatChange(clicksChange)}
                          </td>
                          <td style={{ padding: 12, textAlign: 'right', color: 'rgba(255, 255, 255, 0.9)' }}>
                            <div>{row.impressions.toLocaleString()}</div>
                            {formatChange(impressionsChange)}
                          </td>
                          <td style={{ padding: 12, textAlign: 'right', color: 'rgba(255, 255, 255, 0.9)' }}>
                            <div>{(row.ctr * 100).toFixed(2)}%</div>
                            {formatChange(ctrChange)}
                          </td>
                          <td style={{ padding: 12, textAlign: 'right', color: 'rgba(255, 255, 255, 0.9)' }}>
                            <div>{row.position.toFixed(1)}</div>
                            {formatChange(positionChange)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 style={{ marginBottom: 16, fontSize: 20, fontWeight: 600 }}>
                {selectedQuery ? 'Pages' : 'Top URLs'}
              </h2>
              {selectedQuery && (
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }}>
                    Ranking for: <strong>{selectedQuery}</strong>
                  </span>
                  <button
                    onClick={() => setSelectedQuery(null)}
                    style={{
                      padding: '4px 8px',
                      fontSize: 12,
                      background: 'rgba(255, 255, 255, 0.08)',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Clear filter
                  </button>
                </div>
              )}
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  maxHeight: 500,
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0, 113, 227, 0.08)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', width: '45%' }}>
                        URL
                      </th>
                      <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', width: '14%' }}>
                        Clicks
                      </th>
                      <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', width: '14%' }}>
                        Impr.
                      </th>
                      <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', width: '13%' }}>
                        CTR
                      </th>
                      <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', width: '14%' }}>
                        Pos.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedQuery ? queryUrls : topUrls).map((row, idx) => {
                      const compareRow = (selectedQuery ? queryCompareUrls : compareUrls).find((cu) => cu.keys[0] === row.keys[0]);
                      const getChangePercent = (current: number, previous: number) => {
                        if (previous === 0) return current > 0 ? 100 : 0;
                        return ((current - previous) / previous) * 100;
                      };
                      const clicksChange = compareRow ? getChangePercent(row.clicks, compareRow.clicks) : null;
                      const impressionsChange = compareRow ? getChangePercent(row.impressions, compareRow.impressions) : null;
                      const ctrChange = compareRow ? getChangePercent(row.ctr, compareRow.ctr) : null;
                      const positionChange = compareRow ? getChangePercent(row.position, compareRow.position) : null;
                      
                      const formatChange = (change: number | null) => {
                        if (change === null) return null;
                        const isPositive = change > 0;
                        const sign = isPositive ? '+' : '';
                        return (
                          <div style={{ fontSize: 11, color: isPositive ? '#059669' : '#dc2626', marginTop: 2 }}>
                            {sign}{change.toFixed(1)}%
                          </div>
                        );
                      };

                      return (
                        <tr
                          key={idx}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                            cursor: 'pointer',
                            background: selectedUrl === row.keys[0] ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                          }}
                          onClick={() => {
                            // Toggle URL filter
                            if (selectedUrl === row.keys[0]) {
                              setSelectedUrl(null); // Deselect if clicking same URL
                            } else {
                              setSelectedQuery(null); // Clear query filter when selecting different URL
                              setSelectedUrl(row.keys[0]);
                            }
                          }}
                        >
                          <td style={{ padding: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'rgba(255, 255, 255, 0.9)' }}>
                            {row.keys[0]}
                          </td>
                          <td style={{ padding: 12, textAlign: 'right', color: 'rgba(255, 255, 255, 0.9)' }}>
                            <div>{row.clicks.toLocaleString()}</div>
                            {formatChange(clicksChange)}
                          </td>
                          <td style={{ padding: 12, textAlign: 'right', color: 'rgba(255, 255, 255, 0.9)' }}>
                            <div>{row.impressions.toLocaleString()}</div>
                            {formatChange(impressionsChange)}
                          </td>
                          <td style={{ padding: 12, textAlign: 'right', color: 'rgba(255, 255, 255, 0.9)' }}>
                            <div>{(row.ctr * 100).toFixed(2)}%</div>
                            {formatChange(ctrChange)}
                          </td>
                          <td style={{ padding: 12, textAlign: 'right', color: 'rgba(255, 255, 255, 0.9)' }}>
                            <div>{row.position.toFixed(1)}</div>
                            {formatChange(positionChange)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h2 style={{ marginBottom: 16, fontSize: 22, fontWeight: 700, color: '#FFFFFF' }}>Content Groups</h2>
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 12,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  maxHeight: 500,
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <thead>
                    <tr style={{ background: 'rgba(0, 113, 227, 0.08)', borderBottom: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', width: '40%' }}>
                        Group
                      </th>
                      <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', width: '15%' }}>
                        Clicks
                      </th>
                      <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', width: '15%' }}>
                        Impr.
                      </th>
                      <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', width: '15%' }}>
                        CTR
                      </th>
                      <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)', width: '15%' }}>
                        Pos.
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {contentGroupsWithData.map((group) => {
                      const formatChange = (change: number | undefined) => {
                        if (change === undefined) return null;
                        const isPositive = change > 0;
                        const sign = isPositive ? '+' : '';
                        return (
                          <div style={{ fontSize: 11, color: isPositive ? '#059669' : '#dc2626', marginTop: 2 }}>
                            {sign}{change.toFixed(1)}%
                          </div>
                        );
                      };

                      return (
                        <tr
                          key={group.id}
                          style={{
                            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                            cursor: 'pointer',
                            background: selectedContentGroupId === group.id ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                          }}
                          onClick={() => {
                            // Toggle content group filter
                            if (selectedContentGroupId === group.id) {
                              setSelectedContentGroupId(null); // Deselect if clicking same group
                            } else {
                              setSelectedContentGroupId(group.id);
                            }
                          }}
                        >
                          <td style={{ padding: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{group.name}</div>
                            <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', marginTop: 2 }}>
                              {group.urlCount} URLs
                            </div>
                          </td>
                          <td style={{ padding: 12, textAlign: 'right', color: 'rgba(255, 255, 255, 0.9)' }}>
                            <div>{group.clicks.toLocaleString()}</div>
                            {formatChange(group.clicksChange)}
                          </td>
                          <td style={{ padding: 12, textAlign: 'right', color: 'rgba(255, 255, 255, 0.9)' }}>
                            <div>{group.impressions.toLocaleString()}</div>
                            {formatChange(group.impressionsChange)}
                          </td>
                          <td style={{ padding: 12, textAlign: 'right', color: 'rgba(255, 255, 255, 0.9)' }}>
                            <div>{(group.ctr * 100).toFixed(2)}%</div>
                            {formatChange(group.ctrChange)}
                          </td>
                          <td style={{ padding: 12, textAlign: 'right', color: 'rgba(255, 255, 255, 0.9)' }}>
                            <div>{group.position.toFixed(1)}</div>
                            {formatChange(group.positionChange)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Query Counting Chart - placed under URL table */}
          {queryCountingLoading ? (
            <div style={{ marginTop: 32, padding: 40, textAlign: 'center', background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 12 }}>
              <div style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 8 }}>Loading Query Counting data...</div>
              <div style={{ fontSize: 14, color: '#9ca3af' }}>This may take a moment for long date ranges</div>
            </div>
          ) : (
            <OrganicPositionsChart
              data={positionData}
              compareData={compareRange ? comparePositionData : undefined}
              dateRange={dateRange}
              compareRange={compareRange}
            />
          )}

          {/* GA4 Organic Traffic Section */}
          {showGA4Data && (
            <div style={{ marginTop: 48 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>
                  🌐 Organic Traffic Sources
                </h2>
                {ga4PropertyName && (
                  <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', fontStyle: 'italic' }}>
                    from Google Analytics: {ga4PropertyName} (ID: {ga4PropertyId})
                  </span>
                )}
              </div>

              {ga4Loading ? (
                <div style={{ padding: 40, textAlign: 'center', background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      border: '4px solid #e5e7eb',
                      borderTop: '4px solid #2563eb',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                      margin: '0 auto 12px',
                    }}
                  />
                  <div style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.7)' }}>Loading Analytics data...</div>
                </div>
              ) : ga4Data ? (
                <>
                  <GA4MetricsCards
                    sessions={ga4Data.total.sessions}
                    users={ga4Data.total.users}
                    bounceRate={ga4Data.total.bounceRate}
                    avgDuration={ga4Data.total.avgDuration}
                    comparison={ga4Data.comparison?.total}
                  />
                  <div style={{ marginTop: 24 }}>
                    <SourceBreakdownChart data={ga4Data.bySource} />
                  </div>

                  {/* Comparison with GSC */}
                  <div
                    style={{
                      marginTop: 24,
                      padding: 20,
                      background: 'rgba(0, 113, 227, 0.08)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: 12,
                    }}
                  >
                    <h3 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600 }}>
                      💡 GSC vs GA4 Comparison
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                      <div>
                        <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 4 }}>
                          GSC Clicks (Google only)
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>
                          {metrics.totalClicks.value.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 4 }}>
                          GA4 Sessions (All sources)
                        </div>
                        <div style={{ fontSize: 24, fontWeight: 700 }}>
                          {ga4Data.total.sessions.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 4 }}>
                          Difference
                        </div>
                        <div
                          style={{
                            fontSize: 24,
                            fontWeight: 700,
                            color:
                              ga4Data.total.sessions > metrics.totalClicks.value
                                ? '#059669'
                                : '#dc2626',
                          }}
                        >
                          {ga4Data.total.sessions > metrics.totalClicks.value ? '+' : ''}
                          {(ga4Data.total.sessions - metrics.totalClicks.value).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 12, fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.6 }}>
                      <strong>Note:</strong> GSC shows clicks from Google Search only, while GA4 shows
                      actual website sessions from all organic search sources (Google, Bing, ChatGPT,
                      etc.). Differences can also occur due to bot filtering, tracking, and user
                      behavior.
                    </div>
                  </div>
                </>
              ) : (
                <div
                  style={{
                    padding: 40,
                    textAlign: 'center',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    color: 'rgba(255, 255, 255, 0.7)',
                  }}
                >
                  No Analytics data available
                </div>
              )}
            </div>
          )}

          {!showGA4Data && !ga4Loading && dateRange.startDate && (
            <div
              style={{
                marginTop: 48,
                padding: 24,
                background: 'rgba(0, 113, 227, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'start', gap: 16 }}>
                <div style={{ fontSize: 32 }}>💡</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 600 }}>
                    Connect Google Analytics 4
                  </h3>
                  <p style={{ margin: '0 0 12px 0', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.6 }}>
                    No Google Analytics 4 property detected for this website. Connect GA4 to see
                    organic traffic from all sources (Bing, ChatGPT, DuckDuckGo, etc.), not just
                    Google Search.
                  </p>

                  {ga4DebugInfo && (
                    <div style={{ marginBottom: 12, padding: 12, background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: 8 }}>
                      {ga4DebugInfo.reason && (
                        <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 8, padding: 8, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6 }}>
                          <strong>⚠️ Error:</strong> {ga4DebugInfo.reason}
                          {ga4DebugInfo.errorDetails && (
                            <div style={{ marginTop: 4, fontSize: 12, color: '#991b1b', fontFamily: 'monospace' }}>
                              {ga4DebugInfo.errorDetails}
                            </div>
                          )}
                        </div>
                      )}
                      {ga4DebugInfo.searchedDomain && (
                        <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 4 }}>
                          <strong>Searched for domain:</strong> {ga4DebugInfo.searchedDomain}
                        </div>
                      )}
                      {ga4DebugInfo.availableProperties && ga4DebugInfo.availableProperties.length > 0 ? (
                        <div style={{ marginTop: 12 }}>
                          <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 8 }}>
                            <strong>Available GA4 Properties:</strong>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {ga4DebugInfo.availableProperties.map((prop, idx) => (
                              <div
                                key={idx}
                                style={{
                                  padding: 10,
                                  background: 'rgba(0, 113, 227, 0.08)',
                                  border: '1px solid rgba(255, 255, 255, 0.1)',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  gap: 12,
                                }}
                              >
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{prop.propertyName}</div>
                                  <div style={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                                    Website URL: <span style={{ fontFamily: 'monospace' }}>{prop.websiteUrl}</span>
                                  </div>
                                  <div style={{ color: '#9ca3af', fontSize: 11 }}>
                                    Account: {prop.accountName} • ID: {prop.propertyId}
                                  </div>
                                </div>
                                <button
                                  onClick={() => selectGA4Property(prop.propertyId, prop.propertyName)}
                                  style={{
                                    padding: '8px 16px',
                                    background: '#0071E3',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  Use this property
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: '#dc2626', marginTop: 8 }}>
                          ❌ No GA4 properties found in your Google account
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: 16, marginBottom: 16 }}>
                    <button
                      onClick={() => {
                        // Force sign out and redirect to re-authenticate
                        signOut({ callbackUrl: '/' });
                      }}
                      style={{
                        padding: '12px 24px',
                        background: '#0071E3',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 8,
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      🔄 Log Out and Re-authenticate
                    </button>
                  </div>

                  <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>
                    <strong>Why do I need to re-authenticate?</strong><br />
                    We recently added Google Analytics permissions to this app. You need to log out and log back in so Google can ask you to grant Analytics access.<br /><br />
                    <strong>After re-authentication:</strong><br />
                    1. Make sure to <strong>check the Analytics permission box</strong> when Google asks<br />
                    2. Your GA4 property should have a <strong>Website URL</strong> set in GA4 Admin<br />
                    3. The website URL should match: <code style={{ background: 'rgba(255, 255, 255, 0.06)', padding: '2px 6px', borderRadius: 4 }}>{selectedSite}</code>
                  </p>
                </div>
              </div>
            </div>
          )}
          </>
        </div>
      )}
    </main>
  );
}
