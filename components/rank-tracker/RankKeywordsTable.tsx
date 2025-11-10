import { useState } from 'react';
import KeywordDetailModal from './KeywordDetailModal';

interface KeywordData {
  keyword: string;
  targetUrl?: string;
  tags: string[];
  history: Array<{
    date: Date;
    position: number;
    clicks: number;
    impressions: number;
    ctr: number;
    dfPosition?: number | null;
    dfUrl?: string | null;
    dfLastChecked?: Date | null;
  }>;
  change7d: number | null;
  change30d: number | null;
  createdAt: Date;
}

interface RankKeywordsTableProps {
  keywords: KeywordData[];
  onDelete: (keyword: string) => void;
  onRefresh: () => void;
  siteUrl: string;
}

export default function RankKeywordsTable({
  keywords,
  onDelete,
  onRefresh,
  siteUrl,
}: RankKeywordsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'keyword' | 'position' | 'clicks'>('keyword');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedKeyword, setSelectedKeyword] = useState<KeywordData | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Get all unique tags
  const allTags = Array.from(
    new Set(keywords.flatMap((kw) => kw.tags))
  ).sort();

  // Get latest position for each keyword
  const keywordsWithLatest = keywords.map((kw) => {
    if (!kw.history || kw.history.length === 0) {
      return {
        ...kw,
        currentPosition: null,
        currentClicks: 0,
        currentImpressions: 0,
        lastUpdate: null,
        dfPosition: null,
        dfLastChecked: null,
      };
    }

    // Find latest record with REAL GSC data (position < 900)
    const latestGscRecord = kw.history.find(h => h.position < 900);
    
    // Find latest DataForSEO check (any record with dfPosition)
    const latestDfRecord = kw.history.find(h => h.dfPosition && h.dfLastChecked);

    // ✅ Calculate 30-day total clicks and impressions
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const last30DaysRecords = kw.history.filter(h => {
      return h.position < 900 && new Date(h.date) >= thirtyDaysAgo;
    });
    
    const total30dClicks = last30DaysRecords.reduce((sum, h) => sum + (h.clicks || 0), 0);
    const total30dImpressions = last30DaysRecords.reduce((sum, h) => sum + (h.impressions || 0), 0);

    // Debug logging
    console.log(`[Table] Keyword "${kw.keyword}":`, {
      latestGscDate: latestGscRecord?.date,
      gscPosition: latestGscRecord?.position,
      last30dClicks: total30dClicks,
      last30dImpressions: total30dImpressions,
      last30dDays: last30DaysRecords.length,
      latestDfDate: latestDfRecord?.date,
      dfPosition: latestDfRecord?.dfPosition,
      dfLastChecked: latestDfRecord?.dfLastChecked,
    });

    return {
      ...kw,
      currentPosition: latestGscRecord?.position || null,
      currentClicks: total30dClicks,
      currentImpressions: total30dImpressions,
      lastUpdate: latestGscRecord?.date || null,
      dfPosition: latestDfRecord?.dfPosition || null,
      dfLastChecked: latestDfRecord?.dfLastChecked || null,
    };
  });

  // Filter by search term and tags
  const filteredKeywords = keywordsWithLatest.filter((kw) => {
    const matchesSearch = kw.keyword.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = !selectedTag || kw.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  // Sort
  const sortedKeywords = [...filteredKeywords].sort((a, b) => {
    let comparison = 0;

    if (sortBy === 'keyword') {
      comparison = a.keyword.localeCompare(b.keyword);
    } else if (sortBy === 'position') {
      const posA = a.currentPosition || 999;
      const posB = b.currentPosition || 999;
      comparison = posA - posB;
    } else if (sortBy === 'clicks') {
      comparison = a.currentClicks - b.currentClicks;
    }

    return sortOrder === 'asc' ? comparison : -comparison;
  });

  const handleSort = (column: 'keyword' | 'position' | 'clicks') => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder(column === 'position' ? 'asc' : 'desc');
    }
  };

  return (
    <div
      style={{
        background: '#fff',
        padding: 24,
        borderRadius: 12,
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', margin: 0 }}>
            Keywords ({sortedKeywords.length})
          </h3>

          {/* Search */}
          <input
            type="text"
            placeholder="Search keywords..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              fontSize: 14,
              width: 250,
            }}
          />
        </div>

        {/* Tag Filter */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>Filter by tag:</span>
            <button
              onClick={() => setSelectedTag(null)}
              style={{
                padding: '4px 10px',
                background: !selectedTag ? '#3b82f6' : '#f3f4f6',
                color: !selectedTag ? '#fff' : '#374151',
                border: '1px solid',
                borderColor: !selectedTag ? '#3b82f6' : '#d1d5db',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              All
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                style={{
                  padding: '4px 10px',
                  background: selectedTag === tag ? '#3b82f6' : '#f3f4f6',
                  color: selectedTag === tag ? '#fff' : '#374151',
                  border: '1px solid',
                  borderColor: selectedTag === tag ? '#3b82f6' : '#d1d5db',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      {sortedKeywords.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
          {searchTerm ? 'No keywords match your search' : 'No keywords added yet'}
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                <th
                  onClick={() => handleSort('keyword')}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#374151',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  Keyword {sortBy === 'keyword' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  onClick={() => handleSort('position')}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#374151',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                >
                  GSC Rank {sortBy === 'position' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#374151',
                  }}
                >
                  SERP Rank
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#374151',
                  }}
                >
                  7d Change
                </th>
                <th
                  onClick={() => handleSort('clicks')}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#374151',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  title="Total clicks in the last 30 days"
                >
                  Clicks (30d) {sortBy === 'clicks' && (sortOrder === 'asc' ? '↑' : '↓')}
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#374151',
                  }}
                  title="Total impressions in the last 30 days"
                >
                  Impressions (30d)
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#374151',
                  }}
                >
                  Target URL
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#374151',
                  }}
                >
                  Tags
                </th>
                <th
                  style={{
                    padding: '12px 16px',
                    textAlign: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#374151',
                  }}
                >
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedKeywords.map((kw, index) => {
                const positionColor =
                  !kw.currentPosition ? '#9ca3af'
                  : kw.currentPosition <= 3 ? '#10b981'
                  : kw.currentPosition <= 10 ? '#3b82f6'
                  : kw.currentPosition <= 20 ? '#f59e0b'
                  : '#ef4444';

                return (
                  <tr
                    key={index}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      transition: 'background 0.2s',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                    }}
                    onClick={() => setSelectedKeyword(kw)}
                  >
                    <td style={{ padding: '12px 16px', fontSize: 14, color: '#111827', fontWeight: 500 }}>
                      {kw.keyword}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {kw.currentPosition && kw.currentPosition < 900 ? (
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 700,
                            color: positionColor,
                          }}
                        >
                          #{kw.currentPosition.toFixed(1)}
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: '#9ca3af' }} title="No GSC data yet - click 'Sync GSC Data' to fetch">
                          -
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {kw.dfPosition ? (
                        <div>
                          <span
                            style={{
                              fontSize: 16,
                              fontWeight: 700,
                              color: positionColor,
                            }}
                          >
                            #{kw.dfPosition.toFixed(1)}
                          </span>
                          {kw.dfLastChecked && (
                            <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>
                              {new Date(kw.dfLastChecked).toLocaleDateString('da-DK', { month: 'short', day: 'numeric' })}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 13, color: '#9ca3af' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {kw.change7d !== null && kw.change7d !== undefined ? (
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: 
                              kw.change7d > 0 ? '#10b981'  // Improved (lower position = better)
                              : kw.change7d < 0 ? '#ef4444'  // Declined
                              : '#6b7280',  // No change
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {kw.change7d > 0 ? '↑' : kw.change7d < 0 ? '↓' : '→'}
                          {Math.abs(kw.change7d).toFixed(1)}
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: '#9ca3af' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 14, color: '#374151' }}>
                      {kw.currentClicks.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 14, color: '#374151' }}>
                      {kw.currentImpressions.toLocaleString()}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280', maxWidth: 300 }}>
                      {kw.targetUrl ? (
                        <a
                          href={kw.targetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#3b82f6', textDecoration: 'none' }}
                        >
                          {kw.targetUrl.replace(siteUrl, '').substring(0, 50)}...
                        </a>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12 }}>
                      {kw.tags.length > 0 ? (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'center' }}>
                          {kw.tags.map((tag, i) => (
                            <span
                              key={i}
                              style={{
                                padding: '2px 8px',
                                background: '#eff6ff',
                                color: '#1e40af',
                                borderRadius: 4,
                                fontSize: 11,
                              }}
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(kw.keyword);
                        }}
                        style={{
                          padding: '4px 8px',
                          background: 'transparent',
                          color: '#ef4444',
                          border: '1px solid #fecaca',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Keyword Detail Modal */}
      {selectedKeyword && (
        <KeywordDetailModal
          keyword={selectedKeyword}
          onClose={() => setSelectedKeyword(null)}
        />
      )}
    </div>
  );
}

