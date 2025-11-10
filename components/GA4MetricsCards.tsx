// @ts-nocheck
'use client';

interface GA4MetricsCardsProps {
  sessions: number;
  users: number;
  bounceRate: number;
  avgDuration: number;
  comparison?: {
    sessionsDelta?: number;
    sessionsPercentChange?: number;
    usersDelta?: number;
    usersPercentChange?: number;
  };
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

export default function GA4MetricsCards({
  sessions,
  users,
  bounceRate,
  avgDuration,
  comparison,
}: GA4MetricsCardsProps) {
  const cards = [
    {
      label: 'Sessions',
      value: formatNumber(sessions),
      rawValue: sessions,
      change: comparison?.sessionsDelta,
      changePercent: comparison?.sessionsPercentChange,
    },
    {
      label: 'Users',
      value: formatNumber(users),
      rawValue: users,
      change: comparison?.usersDelta,
      changePercent: comparison?.usersPercentChange,
    },
    {
      label: 'Bounce Rate',
      value: `${(bounceRate * 100).toFixed(1)}%`,
      rawValue: bounceRate,
      // Lower bounce rate is better, so invert the color
      invertColor: true,
    },
    {
      label: 'Avg. Duration',
      value: formatDuration(avgDuration),
      rawValue: avgDuration,
    },
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}
    >
      {cards.map((card) => (
        <div
          key={card.label}
          style={{
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 12,
            padding: 20,
          }}
        >
          <div style={{ fontSize: 13, color: '#FFFFFF', marginBottom: 8, fontWeight: 600, letterSpacing: '0.3px', textTransform: 'uppercase' }}>
            {card.label}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, color: '#51CF66' }}>
            {card.value}
          </div>
          {card.change !== undefined && card.changePercent !== undefined && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                color: card.invertColor
                  ? card.changePercent > 0
                    ? '#dc2626'
                    : '#059669'
                  : card.changePercent > 0
                  ? '#059669'
                  : '#dc2626',
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {card.changePercent > 0 ? '+' : ''}
                {card.changePercent.toFixed(1)}%
              </span>
              <span style={{ color: '#9ca3af' }}>
                ({card.change > 0 ? '+' : ''}
                {formatNumber(card.change)})
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

