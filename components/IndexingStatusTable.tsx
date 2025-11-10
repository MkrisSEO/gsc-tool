'use client';

import type { CSSProperties } from 'react';
import { STATUS_META, IndexingStatus } from './IndexingSummaryCards';

export type { IndexingStatus } from './IndexingSummaryCards';

export interface IndexingHistoryEntry {
  date: string;
  status: IndexingStatus;
}

export interface IndexingPageRow {
  url: string;
  status: IndexingStatus | null;
  lastCrawl: string | null;
  richResults: boolean;
  lastInspection: string | null;
  inspectionFrequency: string;
  history?: IndexingHistoryEntry[];
  clicks?: number;
  impressions?: number;
  ctr?: number;
  position?: number;
  inspected?: boolean;
}

interface IndexingStatusTableProps {
  pages: IndexingPageRow[];
  selectedStatus: IndexingStatus | null;
  onStatusSelect: (status: IndexingStatus | null) => void;
  onRequestIndexing: (url: string) => void;
}

const STATUS_BADGE_COLORS: Record<IndexingStatus, { background: string; text: string }> = {
  submitted_indexed: { background: '#dcfce7', text: '#166534' },
  crawled_not_indexed: { background: '#ffedd5', text: '#9a3412' },
  discovered_not_indexed: { background: '#fee2e2', text: '#b91c1c' },
  unknown: { background: '#dbeafe', text: '#1d4ed8' },
};

export default function IndexingStatusTable({
  pages,
  selectedStatus,
  onStatusSelect,
  onRequestIndexing,
}: IndexingStatusTableProps) {
  const filteredPages = selectedStatus ? pages.filter((page) => page.status === selectedStatus) : pages;

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: 20, borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Pages</h2>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
            {selectedStatus
              ? `${STATUS_META[selectedStatus].label} - ${filteredPages.length.toLocaleString()} URLs`
              : `All statuses - ${filteredPages.length.toLocaleString()} URLs`}
          </p>
        </div>
        {selectedStatus && (
          <button
            onClick={() => onStatusSelect(null)}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid #cbd5f5',
              background: '#f8fafc',
              color: '#2563eb',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Clear filter
          </button>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <tr>
              <th style={thStyle}>URL</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Last Crawl</th>
              <th style={thStyle}>Rich Results</th>
              <th style={thStyle}>Last Inspection</th>
              <th style={thStyle}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredPages.map((page) => {
              const colors = page.status ? STATUS_BADGE_COLORS[page.status] : { background: '#f1f5f9', text: '#64748b' };
              const isInspected = page.inspected === true;

              return (
                <tr key={page.url} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={tdStyle}>
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block',
                        maxWidth: 360,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        color: '#2563eb',
                        textDecoration: 'none',
                        fontWeight: 500,
                      }}
                    >
                      {page.url}
                    </a>
                    {page.clicks !== undefined && (
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                        {page.clicks} clicks • {page.impressions} impressions • Pos. {page.position?.toFixed(1)}
                      </div>
                    )}
                    {page.inspectionFrequency && page.inspectionFrequency !== 'unknown' && (
                      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>
                        Crawled {page.inspectionFrequency}
                      </div>
                    )}
                    {page.history && page.history.length > 0 && (
                      <details style={{ marginTop: 8 }}>
                        <summary style={{ fontSize: 12, color: '#64748b', cursor: 'pointer' }}>
                          Status history
                        </summary>
                        <ul style={{ margin: '8px 0 0 16px', padding: 0, listStyle: 'disc', color: '#64748b', fontSize: 12 }}>
                          {page.history.map((entry) => (
                            <li key={`${page.url}-${entry.date}-${entry.status}`}>
                              <span style={{ fontWeight: 600 }}>{new Date(entry.date).toLocaleDateString()}</span>
                              {': '}
                              {STATUS_META[entry.status].label}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {page.status ? (
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: 999,
                          background: colors.background,
                          color: colors.text,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        {STATUS_META[page.status].label}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                        Not inspected
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    {page.lastCrawl ? new Date(page.lastCrawl).toLocaleDateString() : '—'}
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 13,
                        color: page.richResults ? '#15803d' : '#b91c1c',
                        fontWeight: 600,
                      }}
                    >
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: page.richResults ? '#22c55e' : '#f87171',
                        }}
                        aria-hidden="true"
                      />
                      {page.richResults ? 'Eligible' : 'Not eligible'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {page.lastInspection ? (
                      <>
                        <div>{new Date(page.lastInspection).toLocaleDateString()}</div>
                        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                          {page.inspectionFrequency || 'Unknown frequency'}
                        </div>
                      </>
                    ) : (
                      <span style={{ fontSize: 12, color: '#94a3b8', fontStyle: 'italic' }}>
                        Not inspected yet
                      </span>
                    )}
                  </td>
                  <td style={tdStyle}>
                    <button
                      onClick={() => onRequestIndexing(page.url)}
                      disabled={isInspected}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 8,
                        border: isInspected ? '1px solid #e2e8f0' : '1px solid #bfdbfe',
                        background: isInspected ? '#f8fafc' : '#eff6ff',
                        color: isInspected ? '#94a3b8' : '#1d4ed8',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: isInspected ? 'not-allowed' : 'pointer',
                        opacity: isInspected ? 0.6 : 1,
                      }}
                      title={isInspected ? 'URL already inspected' : 'Click to inspect this URL'}
                    >
                      {isInspected ? '✓ Inspected' : 'Inspect URL'}
                    </button>
                  </td>
                </tr>
              );
            })}
            {filteredPages.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>
                  No URLs match this filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const tdStyle: CSSProperties = {
  padding: '16px',
  verticalAlign: 'top',
  fontSize: 13,
  color: '#0f172a',
};


