'use client';

import { useState } from 'react';

interface TestResult {
  engine: 'gemini';
  success: boolean;
  cited: boolean;
  citationCount: number;
  visibilityScore: number;
  competitors: string[];
  responseExcerpt: string;
  searchQueries?: string[];
  error?: string;
}

interface GEOQueryTesterProps {
  siteUrl: string;
  onQuerySaved?: () => void;
}

export default function GEOQueryTester({ siteUrl, onQuerySaved }: GEOQueryTesterProps) {
  const [query, setQuery] = useState('');
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<TestResult[] | null>(null);

  // Normalize user domain
  const userDomain = siteUrl
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .replace(/^sc-domain:/, '')
    .replace(/\/$/, '')
    .toLowerCase();

  const handleTest = async () => {
    if (!query.trim()) {
      alert('Please enter a query');
      return;
    }

    setTesting(true);
    setResults(null);

    try {
      const response = await fetch('/api/geo/test-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          userDomain,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.results);
      } else {
        alert('Failed to test query: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Test error:', error);
      alert('Failed to test query');
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!results) return;

    try {
      const response = await fetch('/api/geo/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl,
          query,
          priority: 1,
          testResult: { results },
        }),
      });

      const data = await response.json();

      if (response.ok) {
        alert('✅ Query saved successfully!');
        setQuery('');
        setResults(null);
        if (onQuerySaved) onQuerySaved();
      } else {
        alert('Failed to save query: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save query');
    }
  };

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.06)',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 16,
        padding: 24,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      }}
    >
      <h2 style={{ margin: '0 0 16px 0', fontSize: 20, fontWeight: 700, color: '#FFFFFF' }}>
        Test a Query
      </h2>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.9)' }}>
          Enter your query:
        </label>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., hvad er tommer til cm?"
          style={{
            width: '100%',
            padding: '14px 18px',
            fontSize: 14,
            border: '1px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 10,
            background: 'rgba(255, 255, 255, 0.08)',
            color: '#FFFFFF',
            transition: 'all 0.3s ease',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = '#0071E3';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 113, 227, 0.15)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            e.currentTarget.style.boxShadow = 'none';
          }}
          disabled={testing}
        />
      </div>

      <div style={{ marginBottom: 16, padding: 14, background: 'rgba(0, 113, 227, 0.1)', border: '1px solid rgba(0, 113, 227, 0.3)', borderRadius: 10 }}>
        <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.9)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <span><strong>Testing on:</strong> Google Gemini with real-time Google Search</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={handleTest}
          disabled={testing || !query.trim()}
          className="btn-primary"
          style={{ flex: 1 }}
        >
          {testing ? 'Testing...' : 'Test Now'}
        </button>

        {results && (
          <button
            onClick={handleSave}
            style={{
              padding: '10px 20px',
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Save & Track
          </button>
        )}
      </div>

      {/* Results Display */}
      {results && (
        <div style={{ marginTop: 24, paddingTop: 24, borderTop: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
            Test Results
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {results.map((result) => (
              <div
                key={result.engine}
                style={{
                  padding: 16,
                  background: result.cited ? '#f0fdf4' : '#fef2f2',
                  border: `1px solid ${result.cited ? '#86efac' : '#fecaca'}`,
                  borderRadius: 8,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ fontSize: 16, fontWeight: 600, textTransform: 'capitalize' }}>
                      {result.engine}
                    </span>
                    <span
                      style={{
                        padding: '4px 12px',
                        background: result.cited ? '#10b981' : '#dc2626',
                        color: '#fff',
                        fontSize: 12,
                        fontWeight: 600,
                        borderRadius: 6,
                      }}
                    >
                      {result.cited ? '✓ Cited' : '✗ Not Cited'}
                    </span>
                  </div>
                  {result.cited && (
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#10b981' }}>
                      Score: {result.visibilityScore}/100
                    </div>
                  )}
                </div>

                {result.error && (
                  <div style={{ fontSize: 13, color: '#dc2626', marginBottom: 8 }}>
                    Error: {result.error}
                  </div>
                )}

                {result.cited && (
                  <div style={{ fontSize: 13, color: '#059669', marginBottom: 8 }}>
                    Your domain mentioned {result.citationCount} time{result.citationCount !== 1 ? 's' : ''}
                  </div>
                )}

                {result.competitors.length > 0 && (
                  <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)' }}>
                    <strong>Competitors cited:</strong> {result.competitors.slice(0, 5).join(', ')}
                    {result.competitors.length > 5 && ` +${result.competitors.length - 5} more`}
                  </div>
                )}

                {result.responseExcerpt && (
                  <details style={{ marginTop: 12 }}>
                    <summary style={{ cursor: 'pointer', fontSize: 13, color: '#2563eb' }}>
                      View response excerpt
                    </summary>
                    <div
                      style={{
                        marginTop: 8,
                        padding: 12,
                        background: '#f9fafb',
                        borderRadius: 6,
                        fontSize: 13,
                        lineHeight: 1.6,
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {result.responseExcerpt}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

