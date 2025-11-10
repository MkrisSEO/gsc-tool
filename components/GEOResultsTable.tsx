'use client';

import { useState } from 'react';

interface QueryWithResults {
  id: string;
  query: string;
  createdAt: string;
  latestResults?: {
    gemini?: {
      cited: boolean;
      usedAsSource?: boolean;
      visibilityScore: number;
      sourcesFound?: number;
      searchQueries?: string[]; // Fan-out queries Gemini generated
      testedAt: string;
    };
  };
}

interface GEOResultsTableProps {
  queries: QueryWithResults[];
  onRetest: (query: QueryWithResults) => void;
  onDelete: (queryId: string) => void;
  onViewDetails: (query: QueryWithResults) => void;
}

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function GEOResultsTable({
  queries,
  onRetest,
  onDelete,
  onViewDetails,
}: GEOResultsTableProps) {
  const [expandedQuery, setExpandedQuery] = useState<string | null>(null);

  if (queries.length === 0) {
    return (
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          padding: 48,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 56, marginBottom: 16, opacity: 0.6 }}>🔍</div>
        <p style={{ margin: 0, fontSize: 16, color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500 }}>
          No tracked queries yet. Test a query above to get started!
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(0, 113, 227, 0.08)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)' }}>
                Query
              </th>
              <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)' }}>
                Gemini (Google Search)
              </th>
              <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)' }}>
                Last Tested
              </th>
              <th style={{ padding: 12, textAlign: 'right', fontSize: 12, fontWeight: 600, color: 'rgba(255, 255, 255, 0.8)' }}>
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {queries.map((q) => {
              const lastTested = q.latestResults?.gemini?.testedAt;
              
              return (
                <tr
                  key={q.id}
                  style={{
                    borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                    cursor: 'pointer',
                  }}
                  onClick={() => onViewDetails(q)}
                >
                  <td style={{ padding: 14, fontWeight: 500, maxWidth: 400, color: 'rgba(255, 255, 255, 0.9)' }}>
                    {q.query}
                  </td>
                  <td style={{ padding: 14, textAlign: 'center', color: 'rgba(255, 255, 255, 0.9)' }}>
                    {q.latestResults?.gemini ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
                        <div
                          style={{
                            display: 'inline-block',
                            padding: '4px 8px',
                            background: q.latestResults.gemini.cited ? '#d1fae5' : '#fee2e2',
                            color: q.latestResults.gemini.cited ? '#059669' : '#dc2626',
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 4,
                          }}
                        >
                          {q.latestResults.gemini.cited ? '✓ Visible' : '✗ Not Visible'}
                        </div>
                        {q.latestResults.gemini.usedAsSource && (
                          <div
                            style={{
                              display: 'inline-block',
                              padding: '3px 6px',
                              background: '#dbeafe',
                              color: '#1d4ed8',
                              fontSize: 11,
                              fontWeight: 500,
                              borderRadius: 3,
                            }}
                          >
                            📚 Used as Source
                          </div>
                        )}
                        {(q.latestResults.gemini.sourcesFound ?? 0) === 0 && (
                          <div
                            style={{
                              display: 'inline-block',
                              padding: '3px 6px',
                              background: '#fef3c7',
                              color: '#92400e',
                              fontSize: 11,
                              fontWeight: 500,
                              borderRadius: 3,
                            }}
                          >
                            ⚠️ No Sources
                          </div>
                        )}
                        {(q.latestResults.gemini.sourcesFound ?? 0) > 0 && (
                          <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.8)', marginTop: 4 }}>
                            {q.latestResults.gemini.sourcesFound} sources found
                            {q.latestResults.gemini.cited && ` • Score: ${q.latestResults.gemini.visibilityScore}`}
                          </div>
                        )}
                        {q.latestResults.gemini.searchQueries && q.latestResults.gemini.searchQueries.length > 0 && (
                          <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.8)', marginTop: 6, paddingTop: 6, borderTop: '1px solid #e5e7eb' }}>
                            <div style={{ fontWeight: 600, marginBottom: 4, color: '#4b5563' }}>
                              🔍 Fan-out queries ({q.latestResults.gemini.searchQueries.length}):
                            </div>
                            {q.latestResults.gemini.searchQueries.slice(0, 3).map((sq, idx) => (
                              <div key={idx} style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.8)', marginLeft: 8, marginBottom: 2 }}>
                                • {sq}
                              </div>
                            ))}
                            {q.latestResults.gemini.searchQueries.length > 3 && (
                              <div style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.6)', marginLeft: 8, marginTop: 2 }}>
                                +{q.latestResults.gemini.searchQueries.length - 3} more
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)' }}>Not tested</span>
                    )}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center', fontSize: 13, color: 'rgba(255, 255, 255, 0.8)' }}>
                    {lastTested ? formatTimeAgo(lastTested) : '-'}
                  </td>
                  <td style={{ padding: 14, textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetest(q);
                        }}
                        className="btn-secondary"
                        style={{
                          padding: '8px 16px',
                          fontSize: 12,
                        }}
                      >
                        Re-test
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete query "${q.query}"?`)) {
                            onDelete(q.id);
                          }
                        }}
                        className="btn-danger"
                        style={{
                          padding: '8px 16px',
                          fontSize: 12,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

