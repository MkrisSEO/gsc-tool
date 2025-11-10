'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import PerformanceChart from '@/components/PerformanceChart';
import OrganicPositionsChart from '@/components/OrganicPositionsChart';
import { processPositionData } from '@/lib/positionUtils';

export default function UrlDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const url = searchParams?.get('url') || '';
  const siteUrl = searchParams?.get('site') || '';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);
  const [positionData, setPositionData] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [metrics, setMetrics] = useState({
    clicks: 0,
    impressions: 0,
    ctr: 0,
    position: 0,
  });
  const [queryCount, setQueryCount] = useState(0);

  useEffect(() => {
    if (!url || !siteUrl) {
      router.push('/dashboard');
      return;
    }

    fetchUrlData();
  }, [url, siteUrl]);

  const fetchUrlData = async () => {
    setLoading(true);
    setError(null);

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      setDateRange({ startDate: startDateStr, endDate: endDateStr });

      // ✅ USE dimensionFilterGroups to get ALL queries for this specific URL
      // This gives us up to 25k queries instead of ~50-100 with frontend filtering!
      console.log('🔍 [URL Detail] Fetching data for URL:', url);
      
      const res = await fetch('/api/search-console/searchanalytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          startDate: startDateStr,
          endDate: endDateStr,
          dimensions: ['date', 'query'],  // ✅ Only date + query (page filtered by API)
          dimensionFilterGroups: [{  // ✅ Filter by URL at API level
            filters: [{
              dimension: 'page',
              operator: 'equals',
              expression: url,
            }],
          }],
          rowLimit: 25000,  // Now applies to THIS URL only!
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const urlRows = data.data?.rows || [];
      
      console.log('✅ [URL Detail] Fetched rows:', {
        totalRows: urlRows.length,
        sample: urlRows.slice(0, 3).map((r: any) => ({ date: r.keys[0], query: r.keys[1], clicks: r.clicks })),
      });
      
      // Count unique queries
      const uniqueQueries = new Set(urlRows.map((row: any) => row.keys[1]));
      setQueryCount(uniqueQueries.size);
      
      // For time series chart, aggregate by date
      // Now we have ['date', 'query'] dimensions, so keys[0]=date, keys[1]=query
      const dateMap = new Map<string, any>();
      urlRows.forEach((row: any) => {
        const date = row.keys[0];  // keys[0] = date
        if (!dateMap.has(date)) {
          dateMap.set(date, { date, clicks: 0, impressions: 0, ctr: 0, position: 0, count: 0 });
        }
        const entry = dateMap.get(date)!;
        entry.clicks += row.clicks || 0;
        entry.impressions += row.impressions || 0;
        entry.position += row.position || 0;
        entry.count += 1;
      });
      
      const processedData = Array.from(dateMap.values()).map((entry) => ({
        date: entry.date,
        clicks: entry.clicks,
        impressions: entry.impressions,
        ctr: entry.impressions > 0 ? entry.clicks / entry.impressions : 0,
        position: entry.count > 0 ? entry.position / entry.count : 0,
      })).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setChartData(processedData);
      
      // Process position distribution data for Query Counting
      // Data is already filtered by URL via dimensionFilterGroups
      // Dimensions are ['date', 'query'], so no page deduplication needed
      const processedPositionData = processPositionData(urlRows, false);
      setPositionData(processedPositionData);

      const totals = urlRows.reduce(
        (acc: any, row: any) => ({
          clicks: acc.clicks + (row.clicks || 0),
          impressions: acc.impressions + (row.impressions || 0),
          ctr: acc.ctr + (row.ctr || 0),
          position: acc.position + (row.position || 0),
        }),
        { clicks: 0, impressions: 0, ctr: 0, position: 0 }
      );

      const count = urlRows.length;
      setMetrics({
        clicks: totals.clicks,
        impressions: totals.impressions,
        ctr: count > 0 ? totals.ctr / count : 0,
        position: count > 0 ? totals.position / count : 0,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  if (!session) {
    return null;
  }

  return (
    <main style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <button
        onClick={() => router.back()}
        style={{
          marginBottom: 24,
          padding: '8px 16px',
          background: '#f3f4f6',
          border: '1px solid #d1d5db',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 14,
        }}
      >
        ← Back to Dashboard
      </button>

      <h1 style={{ marginBottom: 8, fontSize: 28, fontWeight: 700 }}>URL Performance</h1>
      <p style={{ marginBottom: 8, color: '#6b7280', wordBreak: 'break-all' }}>{url}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <p style={{ color: '#6b7280', margin: 0 }}>Site: {siteUrl}</p>
        {queryCount > 0 && (
          <span
            style={{
              padding: '4px 12px',
              background: '#dbeafe',
              color: '#1e40af',
              borderRadius: 16,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            🔍 {queryCount.toLocaleString()} queries tracked
          </span>
        )}
      </div>

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

      {loading ? (
        <div style={{ padding: 24, textAlign: 'center' }}>Loading...</div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
              marginBottom: 32,
            }}
          >
            <div
              style={{
                padding: 20,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
              }}
            >
              <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Total Clicks</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#2563eb' }}>
                {metrics.clicks.toLocaleString()}
              </div>
            </div>
            <div
              style={{
                padding: 20,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
              }}
            >
              <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Total Impressions</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#059669' }}>
                {metrics.impressions.toLocaleString()}
              </div>
            </div>
            <div
              style={{
                padding: 20,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
              }}
            >
              <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Average CTR</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#dc2626' }}>
                {(metrics.ctr * 100).toFixed(2)}%
              </div>
            </div>
            <div
              style={{
                padding: 20,
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: 12,
              }}
            >
              <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>Average Position</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#7c3aed' }}>
                {metrics.position.toFixed(1)}
              </div>
            </div>
          </div>

          <PerformanceChart data={chartData} />

          {/* Query Counting Chart */}
          <OrganicPositionsChart
            data={positionData}
            compareData={undefined}
            dateRange={dateRange}
            compareRange={null}
          />
        </>
      )}
    </main>
  );
}

