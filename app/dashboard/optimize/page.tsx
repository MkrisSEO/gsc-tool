'use client';
export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import AdvancedDateRangeSelector from '@/components/AdvancedDateRangeSelector';
import Sparkline from '@/components/Sparkline';

type ImpactLevel = 'high' | 'medium' | 'low';

interface CompetingUrl {
  url: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  positionHistory: number[];
  clickShare: number;
}

interface CannibalizationIssue {
  query: string;
  urls: CompetingUrl[];
  totalClicks: number;
  totalImpressions: number;
  avgPosition: number;
  impact: ImpactLevel;
  positionVolatility: number;
  urlCount: number;
}

const IMPACT_COLORS = {
  high: { bg: '#fee2e2', text: '#991b1b', border: '#fecaca' },
  medium: { bg: '#fed7aa', text: '#9a3412', border: '#fdba74' },
  low: { bg: '#dbeafe', text: '#1e40af', border: '#bfdbfe' },
};

export default function OptimizePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedSite, setSelectedSite] = useState('');
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [compareRange, setCompareRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<CannibalizationIssue[]>([]);
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);

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
      fetchCannibalizationData();
    }
  }, [selectedSite, dateRange]);

  const fetchCannibalizationData = async () => {
    if (!selectedSite || !dateRange.startDate || !dateRange.endDate) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/optimize/keyword-cannibalization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: selectedSite,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        }),
      });

      const json = await response.json();

      if (!response.ok || json.error) {
        throw new Error(json.error || 'Failed to fetch cannibalization data');
      }

      setIssues(json.issues || []);
    } catch (err) {
      console.error('Failed to fetch cannibalization data:', err);
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
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
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Optimize - Keyword Cannibalization</h1>
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
        <AdvancedDateRangeSelector
          dateRange={dateRange}
          compareRange={compareRange}
          onDateChange={(startDate, endDate) => {
            setDateRange({ startDate, endDate });
          }}
          onCompareChange={setCompareRange}
        />
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
        <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
          Analyzing keyword cannibalization...
        </div>
      )}

      {!loading && issues.length === 0 && dateRange.startDate && (
        <div style={{ padding: 60, textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600 }}>No Keyword Cannibalization Detected</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
            All queries have a single ranking URL. Great job!
          </p>
        </div>
      )}

      {!loading && issues.length > 0 && (
        <>
          <div
            style={{
              padding: 16,
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 12,
              marginBottom: 24,
              color: '#1e3a8a',
              fontSize: 13,
            }}
          >
            <span style={{ fontWeight: 600 }}>
              Found {issues.length} keyword{issues.length === 1 ? '' : 's'} with cannibalization issues.
            </span>
            <span style={{ marginLeft: 8, opacity: 0.9 }}>
              Click on a query to see competing URLs.
            </span>
          </div>

          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              border: '1px solid #e2e8f0',
              overflow: 'hidden',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <tr>
                  <th style={thStyle}>Query</th>
                  <th style={thStyle}># URLs</th>
                  <th style={thStyle}>Total Clicks</th>
                  <th style={thStyle}>Total Impressions</th>
                  <th style={thStyle}>Avg Position</th>
                  <th style={thStyle}>Impact</th>
                </tr>
              </thead>
              <tbody>
                {issues.map((issue) => {
                  const isExpanded = expandedQuery === issue.query;
                  const colors = IMPACT_COLORS[issue.impact];

                  return (
                    <React.Fragment key={issue.query}>
                      <tr
                        onClick={() => setExpandedQuery(isExpanded ? null : issue.query)}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          cursor: 'pointer',
                          background: isExpanded ? '#f8fafc' : 'transparent',
                        }}
                      >
                        <td style={{ ...tdStyle, fontWeight: 600 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 12, color: '#94a3b8' }}>
                              {isExpanded ? '▼' : '▶'}
                            </span>
                            {issue.query}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: 999,
                              background: '#f1f5f9',
                              color: '#0f172a',
                              fontSize: 13,
                              fontWeight: 600,
                            }}
                          >
                            {issue.urlCount}
                          </span>
                        </td>
                        <td style={tdStyle}>{issue.totalClicks.toLocaleString()}</td>
                        <td style={tdStyle}>{issue.totalImpressions.toLocaleString()}</td>
                        <td style={tdStyle}>{issue.avgPosition.toFixed(1)}</td>
                        <td style={tdStyle}>
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '4px 10px',
                              borderRadius: 999,
                              background: colors.bg,
                              color: colors.text,
                              fontSize: 12,
                              fontWeight: 600,
                              textTransform: 'uppercase',
                              border: `1px solid ${colors.border}`,
                            }}
                          >
                            {issue.impact}
                          </span>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={6} style={{ padding: 0, background: '#f8fafc' }}>
                            <div style={{ padding: 24 }}>
                              <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>
                                Competing URLs for "{issue.query}"
                              </h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {issue.urls.map((url, idx) => (
                                  <div
                                    key={url.url}
                                    style={{
                                      padding: 16,
                                      background: '#fff',
                                      borderRadius: 8,
                                      border: '1px solid #e2e8f0',
                                    }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                                      <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>
                                          #{idx + 1} - {url.clickShare.toFixed(1)}% of clicks
                                        </div>
                                        <a
                                          href={url.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            fontSize: 13,
                                            color: '#2563eb',
                                            textDecoration: 'none',
                                            wordBreak: 'break-all',
                                          }}
                                        >
                                          {url.url}
                                        </a>
                                      </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 12 }}>
                                      <div>
                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Clicks</div>
                                        <div style={{ fontSize: 16, fontWeight: 600 }}>{url.clicks.toLocaleString()}</div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Impressions</div>
                                        <div style={{ fontSize: 16, fontWeight: 600 }}>{url.impressions.toLocaleString()}</div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>CTR</div>
                                        <div style={{ fontSize: 16, fontWeight: 600 }}>{(url.ctr * 100).toFixed(2)}%</div>
                                      </div>
                                      <div>
                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4 }}>Position</div>
                                        <div style={{ fontSize: 16, fontWeight: 600 }}>{url.position.toFixed(1)}</div>
                                      </div>
                                    </div>
                                    {url.positionHistory.length > 1 && (
                                      <div>
                                        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
                                          Position Trend ({url.positionHistory.length} days)
                                          {calculateStdDev(url.positionHistory) > 5 && (
                                            <span style={{ marginLeft: 8, color: '#dc2626', fontWeight: 600 }}>
                                              ⚠️ Unstable
                                            </span>
                                          )}
                                        </div>
                                        <Sparkline 
                                          data={url.positionHistory} 
                                          width={200} 
                                          height={30}
                                          color="#2563eb"
                                          strokeWidth={2}
                                        />
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
  const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  return Math.sqrt(variance);
}

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const tdStyle: React.CSSProperties = {
  padding: '16px',
  fontSize: 14,
  color: '#0f172a',
};

