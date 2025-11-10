'use client';

interface SourceData {
  source: string;
  sessions: number;
  users: number;
  bounceRate: number;
  avgDuration: number;
  percentage: number;
}

interface SourceBreakdownChartProps {
  data: SourceData[];
}

// Color mapping for different sources
const sourceColors: { [key: string]: string } = {
  google: '#4285F4',
  bing: '#008373',
  chatgpt: '#10A37F',
  perplexity: '#1FB8CD',
  duckduckgo: '#DE5833',
  yahoo: '#7B0099',
  unknown: '#9ca3af',
  other: '#9ca3af',
};

function getSourceColor(source: string): string {
  return sourceColors[source.toLowerCase()] || '#64748b';
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function capitalizeSource(source: string): string {
  if (source === 'chatgpt') return 'ChatGPT';
  if (source === 'duckduckgo') return 'DuckDuckGo';
  return source.charAt(0).toUpperCase() + source.slice(1);
}

export default function SourceBreakdownChart({ data }: SourceBreakdownChartProps) {
  if (data.length === 0) {
    return (
      <div
        style={{
          background: '#fff',
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 32,
          textAlign: 'center',
          color: '#6b7280',
        }}
      >
        No organic traffic data available
      </div>
    );
  }

  const maxSessions = Math.max(...data.map((d) => d.sessions));

  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 12,
        padding: 24,
      }}
    >
      <h3 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 600 }}>
        Traffic by Search Engine
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {data.map((source) => (
          <div key={source.source} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Source name and stats */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: getSourceColor(source.source),
                  }}
                />
                <span style={{ fontSize: 14, fontWeight: 600 }}>
                  {capitalizeSource(source.source)}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>
                  {source.sessions.toLocaleString()} sessions
                </span>
                <span style={{ color: '#6b7280' }}>
                  ({source.percentage.toFixed(1)}%)
                </span>
              </div>
            </div>

            {/* Bar */}
            <div
              style={{
                width: '100%',
                height: 8,
                background: '#f3f4f6',
                borderRadius: 4,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${(source.sessions / maxSessions) * 100}%`,
                  height: '100%',
                  background: getSourceColor(source.source),
                  transition: 'width 0.3s ease',
                }}
              />
            </div>

            {/* Additional metrics */}
            <div
              style={{
                display: 'flex',
                gap: 16,
                fontSize: 12,
                color: '#6b7280',
                marginLeft: 20,
              }}
            >
              <span>Users: {source.users.toLocaleString()}</span>
              <span>Bounce: {(source.bounceRate * 100).toFixed(1)}%</span>
              <span>Duration: {formatDuration(source.avgDuration)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


