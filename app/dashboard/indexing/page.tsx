'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import AdvancedDateRangeSelector from '@/components/AdvancedDateRangeSelector';
import IndexingSummaryCards from '@/components/IndexingSummaryCards';
import IndexingStatusChart, { IndexingDailyBreakdown } from '@/components/IndexingStatusChart';
import IndexingStatusTable, { IndexingPageRow, IndexingStatus } from '@/components/IndexingStatusTable';

interface IndexingApiResponse {
  summary: Record<IndexingStatus, number>;
  daily: IndexingDailyBreakdown[];
  pages: IndexingPageRow[];
  totalUrls: number;
  inspectedUrls: number;
}

export default function IndexingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedSite, setSelectedSite] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [compareRange, setCompareRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<IndexingApiResponse | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<IndexingStatus | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCachedData, setIsCachedData] = useState(false);

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
    if (selectedSite && dateRange.startDate && dateRange.endDate) {
      fetchIndexingData(false); // Don't force refresh on initial load
    }
  }, [selectedSite, dateRange]);

  const fetchIndexingData = async (forceRefresh: boolean = false) => {
    if (!selectedSite || !dateRange.startDate || !dateRange.endDate) return;

    setLoading(true);
    setError(null);
    setProgress(null);
    setData(null);

    try {
      console.log(`🔍 Starting indexing overview (forceRefresh: ${forceRefresh})...`);

      if (forceRefresh) {
        setIsRefreshing(true);
      }

      // First, make a POST request to initiate the stream
      const response = await fetch('/api/indexing/overview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: selectedSite,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
          forceRefresh,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start indexing overview');
      }

      // Check if response is JSON (cached data) or SSE stream
      const contentType = response.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        // Handle cached data (non-streaming response)
        console.log('⚡ Received cached data');
        const cachedData = await response.json();
        setData(cachedData);
        setIsCachedData(true);
        setProgress(null);
        setLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('✅ Stream complete');
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const jsonStr = line.substring(6);
            try {
              const parsed = JSON.parse(jsonStr);

              if (parsed.error) {
                throw new Error(parsed.error);
              }

              if (parsed.done) {
                console.log('📦 Final data received:', parsed);
                setData(parsed as IndexingApiResponse);
                setIsCachedData(false); // Fresh data from Google API
                setProgress(null);
                setLoading(false);
                setIsRefreshing(false);
              } else if (parsed.progress !== undefined) {
                console.log(`📊 Progress: ${parsed.progress}/${parsed.total}`);
                setProgress({ current: parsed.progress, total: parsed.total });
              }
            } catch (parseError) {
              console.error('Failed to parse SSE data:', parseError);
            }
          }
        }
      }
    } catch (err) {
      console.error('❌ Indexing fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unexpected error');
      setData(null);
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefreshData = async () => {
    await fetchIndexingData(true); // Force refresh from Google API
  };

  const handleInspectUrl = async (url: string) => {
    try {
      console.log('🔎 Inspecting URL:', url);
      const response = await fetch('/api/indexing/inspect-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: selectedSite,
          url,
        }),
      });

      const result = await response.json();
      
      if (!response.ok || result.error) {
        throw new Error(result.error || 'Failed to inspect URL');
      }

      console.log('✅ Inspection result:', result);

      // Update the page in the data with inspection results
      if (data) {
        const updatedPages = data.pages.map((page) =>
          page.url === url
            ? {
                ...page,
                status: result.status,
                lastCrawl: result.lastCrawl,
                lastInspection: result.lastInspection,
                inspectionFrequency: result.inspectionFrequency,
                richResults: result.richResults,
                inspected: true,
              }
            : page
        );

        setData({
          ...data,
          pages: updatedPages,
        });
      }

      alert(`✅ URL inspected successfully!\n\nStatus: ${result.status}\nLast crawl: ${result.lastCrawl || 'Never'}`);
    } catch (err) {
      console.error('❌ URL inspection error:', err);
      alert(`❌ Failed to inspect URL: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const totalUrls = useMemo(() => {
    if (!data) return 0;
    return (
      data.summary.submitted_indexed +
      data.summary.crawled_not_indexed +
      data.summary.discovered_not_indexed +
      data.summary.unknown
    );
  }, [data]);

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
    <main style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <button
              onClick={() => router.push('/properties')}
              style={{
                padding: '6px 12px',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ← Back to Properties
            </button>
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Indexing Report</h1>
          <p style={{ margin: '8px 0 0', color: '#6b7280' }}>{selectedSite}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, color: '#6b7280' }}>{session.user?.email}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            style={{
              padding: '8px 16px',
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {selectedSite && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <AdvancedDateRangeSelector
              dateRange={dateRange}
              compareRange={compareRange}
              onDateChange={(startDate, endDate) => {
                setDateRange({ startDate, endDate });
              }}
              onCompareChange={setCompareRange}
            />
          </div>
          <button
            onClick={handleRefreshData}
            disabled={loading || isRefreshing}
            style={{
              padding: '10px 20px',
              background: isRefreshing ? '#94a3b8' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: loading || isRefreshing ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              whiteSpace: 'nowrap',
            }}
          >
            {isRefreshing ? '🔄 Refreshing...' : '🔄 Refresh All Data'}
          </button>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 16,
            background: '#fee2e2',
            color: '#b91c1c',
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          {error}
        </div>
      )}

      {loading && (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 18, fontWeight: 600, color: '#0f172a', marginBottom: 8 }}>
              Inspecting URLs with Google Search Console
            </div>
            {progress ? (
              <>
                <div style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
                  Inspecting {progress.current} of {progress.total} URLs...
                </div>
                <div style={{ width: '100%', maxWidth: 600, margin: '0 auto', background: '#e2e8f0', height: 12, borderRadius: 999, overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.round((progress.current / progress.total) * 100)}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #3b82f6 0%, #2563eb 100%)',
                      transition: 'width 0.3s ease',
                      borderRadius: 999,
                    }}
                  />
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 8 }}>
                  {Math.round((progress.current / progress.total) * 100)}% complete
                </div>
              </>
            ) : (
              <div style={{ fontSize: 14, color: '#64748b' }}>
                Starting inspection process...
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && data && (
        <>
          <div
            style={{
              padding: 16,
              background: isCachedData ? '#f0fdf4' : '#eff6ff',
              border: `1px solid ${isCachedData ? '#86efac' : '#bfdbfe'}`,
              borderRadius: 12,
              marginBottom: 24,
              color: isCachedData ? '#166534' : '#1e3a8a',
              fontSize: 13,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {isCachedData 
                ? `⚡ Loaded from cache: ${data.inspectedUrls} URL${data.inspectedUrls === 1 ? '' : 's'} (Click "Refresh All Data" to sync with Google)`
                : `✅ Inspicerede ${data.inspectedUrls} URL${data.inspectedUrls === 1 ? '' : 's'} via Google Search Console URL Inspection API.`
              }
            </span>
            <span style={{ fontSize: 12, opacity: 0.9 }}>
              💡 Alle statuser er præcise og baseret på Google's officielle index-data. Klik "Inspect URL" for at re-inspicere en specifik URL.
            </span>
          </div>

          <IndexingSummaryCards
            summary={data.summary}
            totalUrls={totalUrls}
            selectedStatus={selectedStatus}
            onStatusSelect={setSelectedStatus}
          />

          <IndexingStatusChart
            data={data.daily}
            statusFilter={selectedStatus}
          />

          <IndexingStatusTable
            pages={data.pages}
            selectedStatus={selectedStatus}
            onStatusSelect={setSelectedStatus}
            onRequestIndexing={handleInspectUrl}
          />
        </>
      )}
    </main>
  );
}


