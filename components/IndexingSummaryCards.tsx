'use client';

export type IndexingStatus = 'submitted_indexed' | 'crawled_not_indexed' | 'discovered_not_indexed' | 'unknown';

interface SummaryCounts {
  submitted_indexed: number;
  crawled_not_indexed: number;
  discovered_not_indexed: number;
  unknown: number;
}

interface IndexingSummaryCardsProps {
  summary: SummaryCounts;
  totalUrls: number;
  selectedStatus: IndexingStatus | null;
  onStatusSelect: (status: IndexingStatus | null) => void;
}

const STATUS_META: Record<IndexingStatus, { label: string; color: string; border: string; description: string }> = {
  submitted_indexed: {
    label: 'Submitted and Indexed',
    color: '#15803d',
    border: '#bbf7d0',
    description: 'URLs successfully indexed and eligible to appear in search results.',
  },
  crawled_not_indexed: {
    label: 'Crawled - Not Indexed',
    color: '#c2410c',
    border: '#fed7aa',
    description: 'Pages crawled by Google but excluded (noindex, 404, redirect, duplicate, etc.).',
  },
  discovered_not_indexed: {
    label: 'Discovered - Not Indexed',
    color: '#dc2626',
    border: '#fecaca',
    description: 'Google knows about the page but has not crawled it yet.',
  },
  unknown: {
    label: 'Unknown Status',
    color: '#64748b',
    border: '#cbd5e1',
    description: 'Unable to determine indexing status from Google Search Console.',
  },
};

export default function IndexingSummaryCards({
  summary,
  totalUrls,
  selectedStatus,
  onStatusSelect,
}: IndexingSummaryCardsProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}
    >
      {(Object.keys(STATUS_META) as IndexingStatus[]).map((status) => {
        const meta = STATUS_META[status];
        const count = summary[status];
        const percentage = totalUrls > 0 ? Math.round((count / totalUrls) * 100) : 0;
        const isActive = selectedStatus === status;

        return (
          <button
            key={status}
            onClick={() => onStatusSelect(isActive ? null : status)}
            style={{
              textAlign: 'left',
              padding: 20,
              borderRadius: 12,
              border: `1px solid ${isActive ? meta.color : meta.border}`,
              background: '#fff',
              cursor: 'pointer',
              boxShadow: isActive ? '0 10px 25px rgba(37, 99, 235, 0.15)' : 'none',
              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            }}
            aria-pressed={isActive}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <span style={{
                display: 'inline-block',
                padding: '4px 10px',
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 600,
                background: `${meta.color}1a`,
                color: meta.color,
              }}>
                {meta.label}
              </span>
              <span style={{ fontSize: 12, color: '#94a3b8' }}>{percentage}%</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: meta.color, marginBottom: 8 }}>
              {count.toLocaleString()}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>{meta.description}</p>
            {isActive && (
              <div style={{ marginTop: 12, fontSize: 12, color: meta.color, fontWeight: 600 }}>
                Showing {meta.label} URLs
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}

export { STATUS_META };


