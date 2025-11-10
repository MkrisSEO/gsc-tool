'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import AdvancedDateRangeSelector from '@/components/AdvancedDateRangeSelector';
import RankTrackerOverview from '@/components/rank-tracker/RankTrackerOverview';
import RankPositionChart from '@/components/rank-tracker/RankPositionChart';
import RankKeywordsTable from '@/components/rank-tracker/RankKeywordsTable';
import AddKeywordsModal from '@/components/rank-tracker/AddKeywordsModal';

export default function RankTrackerPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Data states
  const [keywords, setKeywords] = useState<any[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [chartData, setChartData] = useState<any[]>([]);

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
      fetchData();
    }
  }, [selectedSite, dateRange]);

  const fetchData = async () => {
    if (!selectedSite) return;

    setLoading(true);
    setError(null);

    try {
      console.log('[Rank Tracker] Fetching data...');

      // Fetch keywords and overview
      const [keywordsRes, overviewRes] = await Promise.all([
        fetch(`/api/rank-tracker/keywords?siteUrl=${encodeURIComponent(selectedSite)}`),
        fetch(`/api/rank-tracker/overview?siteUrl=${encodeURIComponent(selectedSite)}&days=30`),
      ]);

      if (!keywordsRes.ok || !overviewRes.ok) {
        throw new Error('Failed to fetch rank tracker data');
      }

      const keywordsData = await keywordsRes.json();
      const overviewData = await overviewRes.json();

      setKeywords(keywordsData.keywords || []);
      setOverview(overviewData.overview);

      console.log('[Rank Tracker] ✓ Keywords:', keywordsData.keywords?.length || 0);
      console.log('[Rank Tracker] ✓ Overview:', overviewData.overview);

      // Fetch chart data if we have a date range
      if (dateRange.startDate && dateRange.endDate) {
        const chartRes = await fetch('/api/rank-tracker/overview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteUrl: selectedSite,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
          }),
        });

        if (chartRes.ok) {
          const chartDataRes = await chartRes.json();
          setChartData(chartDataRes.chartData || []);
          console.log('[Rank Tracker] ✓ Chart data:', chartDataRes.chartData?.length || 0);
        }
      }
    } catch (err: any) {
      console.error('[Rank Tracker] Error:', err);
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleAddKeywords = async (keywordsToAdd: any[]) => {
    try {
      console.log('[Rank Tracker] Adding keywords:', keywordsToAdd);

      // Add keywords
      const addRes = await fetch('/api/rank-tracker/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: selectedSite,
          keywords: keywordsToAdd,
        }),
      });

      if (!addRes.ok) {
        const errorData = await addRes.json();
        throw new Error(errorData.error || 'Failed to add keywords');
      }

      const addData = await addRes.json();
      console.log('[Rank Tracker] ✓ Added:', addData.added, 'keywords');

      // Sync GSC data for new keywords
      setSyncing(true);
      const syncRes = await fetch('/api/rank-tracker/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: selectedSite,
          days: 90,
        }),
      });

      if (syncRes.ok) {
        const syncData = await syncRes.json();
        console.log('[Rank Tracker] ✓ Synced:', syncData.synced, 'keywords');
      }

      setSyncing(false);
      setShowAddModal(false);

      // Refresh data
      fetchData();
    } catch (err: any) {
      console.error('[Rank Tracker] Error adding keywords:', err);
      alert(`Failed to add keywords: ${err.message}`);
      setSyncing(false);
    }
  };

  const handleDeleteKeyword = async (keyword: string) => {
    if (!confirm(`Are you sure you want to delete "${keyword}"?`)) {
      return;
    }

    try {
      const res = await fetch(
        `/api/rank-tracker/keywords?siteUrl=${encodeURIComponent(selectedSite)}&keyword=${encodeURIComponent(keyword)}`,
        { method: 'DELETE' }
      );

      if (!res.ok) {
        throw new Error('Failed to delete keyword');
      }

      // Refresh data
      fetchData();
    } catch (err: any) {
      console.error('[Rank Tracker] Error deleting keyword:', err);
      alert(`Failed to delete keyword: ${err.message}`);
    }
  };

  const handleRefreshData = async () => {
    setSyncing(true);
    try {
      const res = await fetch('/api/rank-tracker/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: selectedSite,
          days: 90,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to sync data');
      }

      const data = await res.json();
      console.log('[Rank Tracker] ✓ Synced:', data.synced, 'keywords');

      // Refresh display
      fetchData();
    } catch (err: any) {
      console.error('[Rank Tracker] Error syncing:', err);
      alert(`Failed to sync data: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleCheckLive = async (keywordsList?: string[]) => {
    setChecking(true);
    try {
      console.log('[Rank Tracker] Checking live positions via DataForSEO...');
      
      const res = await fetch('/api/rank-tracker/check-dataforseo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: selectedSite,
          keywords: keywordsList, // If undefined, checks all
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to check positions');
      }

      const data = await res.json();
      console.log('[Rank Tracker] ✓ Checked:', data.checked, 'keywords | Cost: $' + data.totalCost);
      console.log('[Rank Tracker] Debug Info:', data.debug);
      console.log('[Rank Tracker] Results:', data.results);
      console.log('[Rank Tracker] Full API Response:', JSON.stringify(data, null, 2));

      // Show detailed results
      const foundKeywords = data.results?.filter((r: any) => r.found) || [];
      const notFoundKeywords = data.results?.filter((r: any) => !r.found) || [];

      let message = `✅ Checked ${data.totalKeywords} keyword(s)\nCost: $${data.totalCost}\n\n`;
      
      if (foundKeywords.length > 0) {
        message += `Found (${foundKeywords.length}):\n`;
        foundKeywords.forEach((r: any) => {
          message += `  • ${r.keyword}: #${r.position}\n`;
        });
      }
      
      if (notFoundKeywords.length > 0) {
        message += `\nNot found in top 100 (${notFoundKeywords.length}):\n`;
        notFoundKeywords.forEach((r: any) => {
          message += `  • ${r.keyword}\n`;
        });
      }

      alert(message);

      // ✅ Auto-sync GSC data after DataForSEO check (to fill in historical data)
      console.log('[Rank Tracker] Auto-syncing GSC data after DataForSEO check...');
      try {
        const syncRes = await fetch('/api/rank-tracker/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteUrl: selectedSite,
            days: 90,
          }),
        });
        
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          console.log('[Rank Tracker] ✓ Auto-sync completed:', syncData.synced, 'keywords');
        }
      } catch (syncErr) {
        console.error('[Rank Tracker] Auto-sync failed (non-critical):', syncErr);
      }

      // Refresh display
      fetchData();
    } catch (err: any) {
      console.error('[Rank Tracker] Error checking live positions:', err);
      alert(`Failed to check live positions: ${err.message}`);
    } finally {
      setChecking(false);
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
    <main style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
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
              ← Change Site
            </button>
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Rank Tracking</h1>
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

      {/* Date Selector & Actions */}
      {selectedSite && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1 }}>
            <AdvancedDateRangeSelector
              dateRange={dateRange}
              compareRange={null}
              onDateChange={(startDate, endDate) => {
                setDateRange({ startDate, endDate });
              }}
              onCompareChange={() => {}}
            />
          </div>
          <button
            onClick={handleRefreshData}
            disabled={syncing || checking}
            style={{
              padding: '10px 20px',
              background: syncing ? '#94a3b8' : '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: syncing || checking ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {syncing ? '🔄 Syncing...' : '🔄 Refresh GSC'}
          </button>
          <button
            onClick={() => handleCheckLive()}
            disabled={syncing || checking || keywords.length === 0}
            style={{
              padding: '10px 20px',
              background: checking ? '#94a3b8' : '#8b5cf6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: syncing || checking || keywords.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            {checking ? '⏳ Checking...' : '🔴 Check Live'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '10px 20px',
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            + Add Keywords
          </button>
        </div>
      )}

      {/* Error Display */}
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

      {/* Loading State */}
      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
          Loading rank tracking data...
        </div>
      )}

      {/* Main Content */}
      {!loading && overview && keywords.length > 0 && (
        <>
          {/* Overview Cards */}
          <RankTrackerOverview overview={overview} />

          {/* Position Chart */}
          {chartData.length > 0 && (
            <RankPositionChart data={chartData} />
          )}

          {/* Keywords Table */}
          <RankKeywordsTable
            keywords={keywords}
            onDelete={handleDeleteKeyword}
            onRefresh={handleRefreshData}
            siteUrl={selectedSite}
          />
        </>
      )}

      {/* Empty State */}
      {!loading && keywords.length === 0 && (
        <div
          style={{
            padding: 60,
            textAlign: 'center',
            background: '#f9fafb',
            borderRadius: 12,
            border: '2px dashed #d1d5db',
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎯</div>
          <h3 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8, color: '#111827' }}>
            Start Tracking Keywords
          </h3>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
            Add keywords to track their ranking positions over time with GSC data.
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '12px 24px',
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 600,
            }}
          >
            + Add Your First Keywords
          </button>
        </div>
      )}

      {/* Add Keywords Modal */}
      {showAddModal && (
        <AddKeywordsModal
          siteUrl={selectedSite}
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddKeywords}
          syncing={syncing}
        />
      )}
    </main>
  );
}

