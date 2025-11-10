'use client';

interface ComparisonData {
  value: number;
  change?: number;
  changePercent?: number;
}

interface MetricsCardsProps {
  totalClicks: ComparisonData;
  totalImpressions: ComparisonData;
  top1to3Keywords: ComparisonData;
  top4to10Keywords: ComparisonData;
  top20to30Keywords: ComparisonData;
  ctr?: ComparisonData;
}

export default function MetricsCards({
  totalClicks,
  totalImpressions,
  top1to3Keywords,
  top4to10Keywords,
  top20to30Keywords,
  ctr,
}: MetricsCardsProps) {
  const calculatedCtr = totalImpressions.value > 0 
    ? ((totalClicks.value / totalImpressions.value) * 100) 
    : 0;
  
  const ctrChange = ctr?.changePercent || (ctr?.change ? (ctr.change / (ctr.value - ctr.change)) * 100 : undefined);

  const cards = [
    { 
      title: 'Total Clicks', 
      data: totalClicks, 
      color: '#2563eb',
      format: (v: number) => v.toLocaleString(),
      subtitle: '28-day period'
    },
    { 
      title: 'Total Impressions', 
      data: totalImpressions, 
      color: '#7c3aed',
      format: (v: number) => v.toLocaleString(),
      subtitle: '28-day period'
    },
    { 
      title: 'CTR', 
      data: ctr || { value: calculatedCtr, changePercent: ctrChange }, 
      color: '#059669',
      format: (v: number) => `${v.toFixed(2)}%`,
      subtitle: '28-day average'
    },
    { 
      title: 'Position 1-3', 
      data: top1to3Keywords, 
      color: '#7c3aed',
      format: (v: number) => v.toLocaleString(),
      subtitle: 'Latest day'
    },
    { 
      title: 'Position 4-10', 
      data: top4to10Keywords, 
      color: '#ea580c',
      format: (v: number) => v.toLocaleString(),
      subtitle: 'Latest day'
    },
    { 
      title: 'Position 20-30', 
      data: top20to30Keywords, 
      color: '#0891b2',
      format: (v: number) => v.toLocaleString(),
      subtitle: 'Latest day'
    },
  ];

  const formatChange = (change?: number, changePercent?: number) => {
    if (change === undefined && changePercent === undefined) return null;
    const percent = changePercent !== undefined ? changePercent : 0;
    const isPositive = percent > 0;
    const sign = isPositive ? '+' : '';
    return (
      <div style={{ 
        fontSize: 11, 
        color: isPositive ? '#51CF66' : '#FF6B6B',
        marginTop: 6,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontWeight: 600
      }}>
        <span>{isPositive ? '↑' : '↓'} {sign}{percent.toFixed(1)}%</span>
        {change !== undefined && (
          <span style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.5)', fontWeight: 400 }}>
            ({sign}{change.toLocaleString()})
          </span>
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 16,
        marginBottom: 32,
      }}
    >
      {cards.map((card) => (
        <div
          key={card.title}
          style={{
            padding: '18px 16px',
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
            borderRadius: 14,
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            minWidth: 0, // Allow cards to shrink below content size
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 12px 24px rgba(59, 130, 246, 0.15)';
            e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.7)', marginBottom: 4, fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              {card.title}
            </div>
            {(card as any).subtitle && (
              <div style={{ fontSize: 9, color: 'rgba(255, 255, 255, 0.5)', marginBottom: 6 }}>
                {(card as any).subtitle}
              </div>
            )}
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#FFFFFF', marginBottom: 4, lineHeight: 1.1 }}>
            {card.format(card.data.value)}
          </div>
          {formatChange(card.data.change, card.data.changePercent)}
        </div>
      ))}
    </div>
  );
}

