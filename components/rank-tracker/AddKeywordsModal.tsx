import { useState } from 'react';

interface AddKeywordsModalProps {
  siteUrl: string;
  onClose: () => void;
  onAdd: (keywords: Array<{ keyword: string; targetUrl?: string; tags?: string[] }>) => void;
  syncing: boolean;
}

export default function AddKeywordsModal({ siteUrl, onClose, onAdd, syncing }: AddKeywordsModalProps) {
  const [manualInput, setManualInput] = useState('');
  const [tags, setTags] = useState<string>('');
  const [gscKeywords, setGscKeywords] = useState<any[]>([]);
  const [selectedGscKeywords, setSelectedGscKeywords] = useState<Set<string>>(new Set());
  const [loadingGsc, setLoadingGsc] = useState(false);
  const [activeTab, setActiveTab] = useState<'manual' | 'gsc'>('manual');

  const handleImportFromGsc = async () => {
    setLoadingGsc(true);
    try {
      const res = await fetch('/api/rank-tracker/import-gsc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          limit: 50,
          days: 28,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to import keywords');
      }

      const data = await res.json();
      setGscKeywords(data.keywords || []);
      console.log('[Add Keywords] Imported:', data.keywords?.length, 'keywords from GSC');
    } catch (err: any) {
      console.error('[Add Keywords] Error importing:', err);
      alert(`Failed to import keywords: ${err.message}`);
    } finally {
      setLoadingGsc(false);
    }
  };

  const handleSubmit = () => {
    const keywordsToAdd: Array<{ keyword: string; targetUrl?: string; tags?: string[] }> = [];
    
    // Parse tags
    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // From manual input
    if (activeTab === 'manual' && manualInput.trim()) {
      const lines = manualInput.trim().split('\n');
      lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed) {
          keywordsToAdd.push({ 
            keyword: trimmed,
            tags: parsedTags.length > 0 ? parsedTags : undefined,
          });
        }
      });
    }

    // From GSC selection
    if (activeTab === 'gsc') {
      gscKeywords.forEach((gscKw) => {
        if (selectedGscKeywords.has(gscKw.keyword)) {
          keywordsToAdd.push({
            keyword: gscKw.keyword,
            targetUrl: gscKw.targetUrl,
            tags: parsedTags.length > 0 ? parsedTags : undefined,
          });
        }
      });
    }

    if (keywordsToAdd.length === 0) {
      alert('Please add at least one keyword');
      return;
    }

    onAdd(keywordsToAdd);
  };

  const toggleGscKeyword = (keyword: string) => {
    const newSet = new Set(selectedGscKeywords);
    if (newSet.has(keyword)) {
      newSet.delete(keyword);
    } else {
      newSet.add(keyword);
    }
    setSelectedGscKeywords(newSet);
  };

  const selectTopN = (n: number) => {
    const newSet = new Set<string>();
    gscKeywords.slice(0, n).forEach((kw) => newSet.add(kw.keyword));
    setSelectedGscKeywords(newSet);
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          padding: 32,
          borderRadius: 16,
          maxWidth: 700,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#111827' }}>
            Add Keywords to Track
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 24,
              cursor: 'pointer',
              color: '#6b7280',
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '2px solid #e5e7eb' }}>
          <button
            onClick={() => setActiveTab('manual')}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'manual' ? '3px solid #3b82f6' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              color: activeTab === 'manual' ? '#3b82f6' : '#6b7280',
              marginBottom: -2,
            }}
          >
            Manual Entry
          </button>
          <button
            onClick={() => {
              setActiveTab('gsc');
              if (gscKeywords.length === 0) {
                handleImportFromGsc();
              }
            }}
            style={{
              padding: '8px 16px',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'gsc' ? '3px solid #3b82f6' : '3px solid transparent',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              color: activeTab === 'gsc' ? '#3b82f6' : '#6b7280',
              marginBottom: -2,
            }}
          >
            Import from GSC
          </button>
        </div>

        {/* Manual Input Tab */}
        {activeTab === 'manual' && (
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8, color: '#374151' }}>
              Enter keywords (one per line):
            </label>
            <textarea
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="omregne fod til cm&#10;celsius til fahrenheit&#10;km til miles&#10;..."
              style={{
                width: '100%',
                minHeight: 200,
                padding: 12,
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 14,
                fontFamily: 'monospace',
                resize: 'vertical',
              }}
            />
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 8 }}>
              {manualInput.trim().split('\n').filter(l => l.trim()).length} keywords entered
            </div>

            {/* Tags Input */}
            <div style={{ marginTop: 16 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8, color: '#374151' }}>
                Tags (optional, comma-separated):
              </label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="High-Priority, Omregning, Brand..."
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  fontSize: 14,
                }}
              />
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                These tags will be applied to all keywords you add
              </div>
            </div>
          </div>
        )}

        {/* GSC Import Tab */}
        {activeTab === 'gsc' && (
          <div>
            {loadingGsc ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>
                Loading top keywords from GSC...
              </div>
            ) : gscKeywords.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <button
                  onClick={handleImportFromGsc}
                  style={{
                    padding: '10px 20px',
                    background: '#3b82f6',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: 600,
                  }}
                >
                  Load Keywords from GSC
                </button>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>
                    Select keywords ({selectedGscKeywords.size} selected)
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => selectTopN(10)}
                      style={{
                        padding: '4px 12px',
                        background: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      Select Top 10
                    </button>
                    <button
                      onClick={() => selectTopN(20)}
                      style={{
                        padding: '4px 12px',
                        background: '#f3f4f6',
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                    >
                      Select Top 20
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    maxHeight: 300,
                    overflow: 'auto',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                  }}
                >
                  {gscKeywords.map((gscKw, index) => (
                    <div
                      key={index}
                      onClick={() => toggleGscKeyword(gscKw.keyword)}
                      style={{
                        padding: '10px 12px',
                        borderBottom: index < gscKeywords.length - 1 ? '1px solid #f3f4f6' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        background: selectedGscKeywords.has(gscKw.keyword) ? '#eff6ff' : 'transparent',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedGscKeywords.has(gscKw.keyword)}
                        onChange={() => {}}
                        style={{ cursor: 'pointer' }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: '#111827' }}>
                          {gscKw.keyword}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>
                          {gscKw.clicks} clicks • Pos #{gscKw.position}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Tags Input for GSC */}
                {gscKeywords.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8, color: '#374151' }}>
                      Tags (optional, comma-separated):
                    </label>
                    <input
                      type="text"
                      value={tags}
                      onChange={(e) => setTags(e.target.value)}
                      placeholder="High-Priority, Omregning, Brand..."
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #d1d5db',
                        borderRadius: 6,
                        fontSize: 14,
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24, paddingTop: 24, borderTop: '1px solid #e5e7eb' }}>
          <button
            onClick={onClose}
            disabled={syncing}
            style={{
              padding: '10px 20px',
              background: '#f3f4f6',
              color: '#374151',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              cursor: syncing ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={syncing}
            style={{
              padding: '10px 20px',
              background: syncing ? '#94a3b8' : '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: syncing ? 'not-allowed' : 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            {syncing ? '⏳ Adding & Syncing...' : 'Add Keywords'}
          </button>
        </div>
      </div>
    </div>
  );
}

