'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import GEOQueryTester from '@/components/GEOQueryTester';
import GEOResultsTable from '@/components/GEOResultsTable';
import GEOStatsCards from '@/components/GEOStatsCards';
import GEOCompetitorComparison from '@/components/GEOCompetitorComparison';

export default function GEOPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedSite, setSelectedSite] = useState<string>('');
  const [queries, setQueries] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importedQueries, setImportedQueries] = useState<any[]>([]);
  const [autoImported, setAutoImported] = useState(false);
  const [competitorData, setCompetitorData] = useState<any>(null);
  const [showCompetitorAnalysis, setShowCompetitorAnalysis] = useState(false);

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
    if (selectedSite) {
      fetchQueries();
      fetchStats();
      fetchCompetitorData();
    }
  }, [selectedSite]);

  // Auto-import top GSC queries on first visit
  useEffect(() => {
    if (selectedSite && queries.length === 0 && !loading && !autoImported) {
      autoImportTopQueries();
    }
  }, [selectedSite, queries, loading, autoImported]);

  const fetchQueries = async () => {
    if (!selectedSite) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/geo/queries?siteUrl=${encodeURIComponent(selectedSite)}`);
      const data = await response.json();

      if (response.ok) {
        setQueries(data.queries || []);
      }
    } catch (error) {
      console.error('Failed to fetch queries:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    if (!selectedSite) return;

    try {
      const response = await fetch(`/api/geo/stats?siteUrl=${encodeURIComponent(selectedSite)}`);
      const data = await response.json();

      if (response.ok) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchCompetitorData = async () => {
    if (!selectedSite) return;

    try {
      const response = await fetch(`/api/geo/competitor-analysis?siteUrl=${encodeURIComponent(selectedSite)}`);
      const data = await response.json();

      if (response.ok) {
        setCompetitorData(data);
      }
    } catch (error) {
      console.error('Failed to fetch competitor data:', error);
    }
  };

  const handleRetest = async (query: any) => {
    try {
      // Normalize domain
      const normalizedDomain = selectedSite
        .replace(/^(https?:\/\/)?(www\.)?/, '')
        .replace(/^sc-domain:/, '')
        .replace(/\/$/, '')
        .toLowerCase();

      // Test the query on Gemini
      const testResponse = await fetch('/api/geo/test-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query.query,
          userDomain: normalizedDomain,
        }),
      });

      const testData = await testResponse.json();

      if (testData.success) {
        // Save the results
        await fetch('/api/geo/queries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteUrl: selectedSite,
            query: query.query,
            priority: 1,
            testResult: testData,
          }),
        });

        // Refresh
        fetchQueries();
        fetchStats();
        fetchCompetitorData();
      }
    } catch (error) {
      console.error('Retest error:', error);
      alert('Failed to re-test query');
    }
  };

  const handleTestAll = async () => {
    if (!confirm(`Test all ${queries.length} queries on Gemini? This will use API credits.`)) {
      return;
    }

    setImportLoading(true);
    try {
      const response = await fetch('/api/geo/test-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: selectedSite,
        }),
      });

      if (response.ok) {
        alert('✅ All queries tested successfully!');
      }

      fetchQueries();
      fetchStats();
      fetchCompetitorData();
    } catch (error) {
      console.error('Test all error:', error);
      alert('Failed to test all queries');
    } finally {
      setImportLoading(false);
    }
  };

  const handleDelete = async (queryId: string) => {
    try {
      const response = await fetch(`/api/geo/queries?id=${queryId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchQueries();
        fetchStats();
        fetchCompetitorData();
      } else {
        alert('Failed to delete query');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete query');
    }
  };

  const handleViewDetails = (query: any) => {
    // TODO: Show modal or navigate to detail page
    console.log('View details for:', query);
  };

  const autoImportTopQueries = async () => {
    console.log('[GEO] Auto-importing and testing top 200 GSC queries...');
    setImportLoading(true);
    setAutoImported(true);

    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await fetch('/api/geo/import-gsc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: selectedSite,
          startDate,
          endDate,
          minImpressions: 50,
          limit: 200,
        }),
      });

      const data = await response.json();

      if (response.ok && data.queries) {
        console.log(`[GEO] Auto-imported ${data.queries.length} queries, now testing all...`);
        
        // Import and test all queries on Gemini
        await fetch('/api/geo/import-and-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            siteUrl: selectedSite,
            queries: data.queries,
          }),
        });
        
        // Refresh after all tests complete
        fetchQueries();
        fetchStats();
        fetchCompetitorData();
      }
    } catch (error) {
      console.error('Auto-import error:', error);
    } finally {
      setImportLoading(false);
    }
  };

  const handleImportFromGSC = async () => {
    setImportLoading(true);
    setImportedQueries([]);

    try {
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const response = await fetch('/api/geo/import-gsc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: selectedSite,
          startDate,
          endDate,
          minImpressions: 50,
          limit: 100, // More queries for manual import
        }),
      });

      const data = await response.json();

      if (response.ok && data.queries) {
        setImportedQueries(data.queries);
        setShowImportModal(true);
      } else {
        alert('Failed to import queries: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Import error:', error);
      alert('Failed to import queries');
    } finally {
      setImportLoading(false);
    }
  };

  const handleAddImportedQuery = async (importedQuery: any) => {
    try {
      const response = await fetch('/api/geo/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: selectedSite,
          query: importedQuery.query,
          priority: 1,
        }),
      });

      if (response.ok) {
        // Remove from imported list
        setImportedQueries(importedQueries.filter(q => q.query !== importedQuery.query));
        fetchQueries();
        fetchStats();
        fetchCompetitorData();
      }
    } catch (error) {
      console.error('Failed to add query:', error);
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
    <main style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: '#FFFFFF' }}>
          GEO Tracking
        </h1>
          <div style={{ display: 'flex', gap: 12 }}>
            {queries.length > 0 && (
              <button
                onClick={handleTestAll}
                disabled={importLoading}
                style={{
                  padding: '10px 20px',
                  background: importLoading ? '#9ca3af' : '#7c3aed',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: importLoading ? 'not-allowed' : 'pointer',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                🔄 Test All Queries
              </button>
            )}
            <button
              onClick={handleImportFromGSC}
              disabled={importLoading}
              className="btn-secondary"
            >
              {importLoading ? 'Importing...' : '+ Add More Keywords'}
            </button>
          </div>
        </div>
        <p style={{ margin: '8px 0 0', color: 'rgba(255, 255, 255, 0.7)' }}>
          Track how often your website appears in AI-generated search results
        </p>
      </div>

      {/* Auto-import loading indicator */}
      {importLoading && queries.length === 0 && (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            marginBottom: 32,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              border: '4px solid #e5e7eb',
              borderTop: '4px solid #2563eb',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 16px',
            }}
          />
          <div style={{ fontSize: 16, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 8 }}>
            Setting up GEO tracking...
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.6)', marginBottom: 4 }}>
            Importing and testing top 200 informational queries from Search Console
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.6)' }}>
            This takes ~1 minute with Tier 1 API.
            Testing each query on Gemini 2.0 Flash with Google Search...
          </div>
        </div>
      )}

      {/* Main Content - 2 Column Layout */}
      {!importLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 24 }}>
          {/* Left Column - Main Content */}
          <div>
            {/* Stats Overview */}
            {stats && <GEOStatsCards stats={stats} />}

            {/* Competitor Comparison */}
            {competitorData && queries.length > 0 && (
              <div style={{ marginBottom: 32 }}>
                <GEOCompetitorComparison
                  userDomain={selectedSite.replace(/^https?:\/\//, '').replace(/^sc-domain:/, '').replace(/^www\./, '').replace(/\/$/, '')}
                  queries={queries}
                  allResults={competitorData.allResults || []}
                />
              </div>
            )}

            {/* Tracked Queries Table */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#FFFFFF' }}>
            Tracked Queries ({queries.length})
          </h2>
              </div>
              {loading ? (
                <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255, 255, 255, 0.7)' }}>
                  Loading queries...
                </div>
              ) : (
                <GEOResultsTable
                  queries={queries}
                  onRetest={handleRetest}
                  onDelete={handleDelete}
                  onViewDetails={handleViewDetails}
                />
              )}
            </div>
          </div>

          {/* Right Sidebar - Quick Actions */}
          <div>
            <div
              style={{
                position: 'sticky',
                top: 24,
              }}
            >
              {/* Quick Test */}
              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 16, color: '#FFFFFF' }}>
                  Quick Test
                </h3>
                <GEOQueryTester 
                  siteUrl={selectedSite} 
                  onQuerySaved={() => {
                    fetchQueries();
                    fetchStats();
                    fetchCompetitorData();
                  }} 
                />
              </div>

              {/* Quick Stats */}
              {stats && (
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    backdropFilter: 'blur(10px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: '#FFFFFF' }}>
                    Quick Stats
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }}>Total Queries:</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>{stats.totalQueries}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }}>Citation Rate:</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: stats.citationRate.gemini > 0 ? '#51CF66' : '#FF6B6B' }}>
                        {stats.citationRate.gemini.toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }}>Sources Found:</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>
                        {stats.sourcesFoundRate.gemini.toFixed(0)}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 14, marginTop: 4, borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
                      <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)' }}>Avg Fan-outs:</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF' }}>
                        {stats.avgFanOutQueries.gemini.toFixed(1)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowImportModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              maxWidth: 600,
              maxHeight: '80vh',
              overflow: 'auto',
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>
                Import Queries from Search Console
              </h2>
              <button
                onClick={() => setShowImportModal(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  color: 'rgba(255, 255, 255, 0.7)',
                }}
              >
                ×
              </button>
            </div>

            <p style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 16 }}>
              Found {importedQueries.length} informational queries. Click to add them to tracking:
            </p>

            {importedQueries.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255, 255, 255, 0.6)' }}>
                No informational queries found. Try lowering minimum impressions or different date range.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {importedQueries.map((q) => (
                  <div
                    key={q.query}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 12,
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
                        {q.query}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.7)' }}>
                        {q.impressions.toLocaleString()} impressions • Type: {q.type}
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddImportedQuery(q)}
                      style={{
                        padding: '6px 12px',
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 12,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Add to tracking
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

