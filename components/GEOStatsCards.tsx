'use client';

interface GEOStatsCardsProps {
  stats: {
    totalQueries: number;
    totalTests: number;
    citationRate: {
      gemini: number;
      overall: number;
    };
    usedAsSourceRate: {
      gemini: number;
    };
    sourcesFoundRate: {
      gemini: number;
    };
    avgSourcesFound: {
      gemini: number;
    };
    avgFanOutQueries: {
      gemini: number;
    };
    topCompetitors: Array<{ domain: string; count: number }>;
  };
}

export default function GEOStatsCards({ stats }: GEOStatsCardsProps) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 16,
            padding: 24,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 8, fontWeight: 500 }}>
            Tracked Queries
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#FFFFFF' }}>
            {stats.totalQueries}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)', marginTop: 4 }}>
            {stats.totalTests} total tests
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 16,
            padding: 24,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 8, fontWeight: 500 }}>
            Visible Citation Rate
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#FFFFFF' }}>
            {stats.citationRate.gemini.toFixed(0)}%
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)', marginTop: 4 }}>
            Link shown to users
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 16,
            padding: 24,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 8, fontWeight: 500 }}>
            Used as Source
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#FFFFFF', color: '#4285F4' }}>
            {stats.usedAsSourceRate.gemini.toFixed(0)}%
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)', marginTop: 4 }}>
            In grounding metadata
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 16,
            padding: 24,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 8, fontWeight: 500 }}>
            Sources Found
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#FFFFFF', color: '#f59e0b' }}>
            {stats.sourcesFoundRate.gemini.toFixed(0)}%
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)', marginTop: 4 }}>
            Avg: {stats.avgSourcesFound.gemini.toFixed(1)} sources/query
          </div>
        </div>

        <div
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 16,
            padding: 24,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}
        >
          <div style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 8, fontWeight: 500 }}>
            Fan-out Queries
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: '#FFFFFF', color: '#8b5cf6' }}>
            {stats.avgFanOutQueries.gemini.toFixed(1)}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.6)', marginTop: 4 }}>
            {stats.avgFanOutQueries.gemini === 0 ? 'Re-test to see fan-outs' : 'Avg searches per query'}
          </div>
        </div>
      </div>

      {/* Top Competitors */}
      {stats.topCompetitors.length > 0 && (
        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 20,
            marginTop: 24,
          }}
        >
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16, fontWeight: 600 }}>
            Top Cited Competitors
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stats.topCompetitors.slice(0, 5).map((comp, idx) => (
              <div
                key={comp.domain}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: '#f9fafb',
                  borderRadius: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255, 255, 255, 0.6)', minWidth: 20 }}>
                    #{idx + 1}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>
                    {comp.domain}
                  </span>
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255, 255, 255, 0.7)' }}>
                  {comp.count} citation{comp.count !== 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

