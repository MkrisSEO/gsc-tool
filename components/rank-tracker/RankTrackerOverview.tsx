interface RankTrackerOverviewProps {
  overview: {
    totalKeywords: number;
    avgPosition: number;
    top3: number;
    top10: number;
    positionDistribution: {
      top3: number;
      top10: number;
      top20: number;
      top50: number;
      beyond50: number;
    };
  };
}

export default function RankTrackerOverview({ overview }: RankTrackerOverviewProps) {
  const cards = [
    {
      title: 'Total Keywords',
      value: overview.totalKeywords,
      subtitle: 'Tracked keywords',
      icon: '🎯',
      color: '#3b82f6',
    },
    {
      title: 'Avg SERP Position',
      value: overview.avgPosition.toFixed(1),
      subtitle: 'Live ranking position',
      icon: '📊',
      color: '#8b5cf6',
      trend: null,
    },
    {
      title: 'Top 3',
      value: overview.top3,
      subtitle: `${overview.totalKeywords > 0 ? Math.round((overview.top3 / overview.totalKeywords) * 100) : 0}% of keywords`,
      icon: '🥇',
      color: '#10b981',
    },
    {
      title: 'Top 10',
      value: overview.top10,
      subtitle: `${overview.totalKeywords > 0 ? Math.round((overview.top10 / overview.totalKeywords) * 100) : 0}% of keywords`,
      icon: '🏆',
      color: '#f59e0b',
    },
  ];

  const maxDistribution = Math.max(
    overview.positionDistribution.top3,
    overview.positionDistribution.top10,
    overview.positionDistribution.top20,
    overview.positionDistribution.top50,
    overview.positionDistribution.beyond50
  );

  return (
    <>
      {/* Metrics Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {cards.map((card, index) => (
          <div
            key={index}
            style={{
              background: '#fff',
              padding: 20,
              borderRadius: 12,
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 4 }}>{card.title}</div>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#111827' }}>{card.value}</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{card.subtitle}</div>
              </div>
              <div style={{ fontSize: 32, opacity: 0.2 }}>{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Position Distribution */}
      <div
        style={{
          background: '#fff',
          padding: 24,
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: 24,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20, color: '#111827' }}>
          Position Distribution
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16 }}>
          {[
            { label: 'Top 3', value: overview.positionDistribution.top3, color: '#10b981' },
            { label: '4-10', value: overview.positionDistribution.top10, color: '#3b82f6' },
            { label: '11-20', value: overview.positionDistribution.top20, color: '#f59e0b' },
            { label: '21-50', value: overview.positionDistribution.top50, color: '#ef4444' },
            { label: '50+', value: overview.positionDistribution.beyond50, color: '#6b7280' },
          ].map((item, index) => {
            const percentage = overview.totalKeywords > 0
              ? Math.round((item.value / overview.totalKeywords) * 100)
              : 0;
            const barHeight = maxDistribution > 0
              ? Math.max(20, (item.value / maxDistribution) * 120)
              : 20;

            return (
              <div key={index} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    height: 140,
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 80,
                      height: barHeight,
                      background: item.color,
                      borderRadius: '8px 8px 0 0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    {item.value}
                  </div>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 4 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>
                  {percentage}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

