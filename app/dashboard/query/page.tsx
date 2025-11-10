'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import PerformanceChart from '@/components/PerformanceChart';
import OrganicPositionsChart from '@/components/OrganicPositionsChart';
import { processPositionData } from '@/lib/positionUtils';

export default function QueryDetailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const query = searchParams?.get('q') || '';
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

  useEffect(() => {
    if (!query || !siteUrl) {
      router.push('/dashboard');
      return;
    }

    fetchQueryData();
  }, [query, siteUrl]);

  const fetchQueryData = async () => {
    setLoading(true);
    setError(null);

    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 90);
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      setDateRange({ startDate: startDateStr, endDate: endDateStr });

      const res = await fetch('/api/search-console/searchanalytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          startDate: startDateStr,
          endDate: endDateStr,
          dimensions: ['date', 'query'],
          rowLimit: 1000,
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const rows = data.data?.rows || [];
      const queryRows = rows.filter((row: any) => row.keys[1] === query);

      const processedData = queryRows.map((row: any) => ({
        date: row.keys[0],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      }));

      setChartData(processedData);
      
      // Process position distribution data for Query Counting (use same data)
      const processedPositionData = processPositionData(queryRows, false);
      setPositionData(processedPositionData);

      const totals = queryRows.reduce(
        (acc: any, row: any) => ({
          clicks: acc.clicks + (row.clicks || 0),
          impressions: acc.impressions + (row.impressions || 0),
          ctr: acc.ctr + (row.ctr || 0),
          position: acc.position + (row.position || 0),
        }),
        { clicks: 0, impressions: 0, ctr: 0, position: 0 }
      );

      const count = queryRows.length;
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

      <h1 style={{ marginBottom: 8, fontSize: 28, fontWeight: 700 }}>Query: {query}</h1>
      <p style={{ marginBottom: 24, color: '#6b7280' }}>Site: {siteUrl}</p>

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

