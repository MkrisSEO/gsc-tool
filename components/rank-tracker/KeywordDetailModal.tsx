import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface KeywordDetailModalProps {
  keyword: {
    keyword: string;
    targetUrl?: string;
    tags: string[];
    history: Array<{
      date: Date;
      position: number;
      clicks: number;
      impressions: number;
      ctr: number;
    }>;
    change7d: number | null;
    change30d: number | null;
  };
  onClose: () => void;
}

export default function KeywordDetailModal({ keyword, onClose }: KeywordDetailModalProps) {
  // Get latest record
  const latestRecord = keyword.history.length > 0 ? keyword.history[0] : null;
  
  // Calculate statistics - prefer SERP data when available
  const getCurrentPosition = () => {
    if (latestRecord?.dfPosition && latestRecord?.dfLastChecked) {
      const daysSinceCheck = (Date.now() - new Date(latestRecord.dfLastChecked).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceCheck <= 7) return latestRecord.dfPosition;
    }
    return latestRecord?.position && latestRecord.position < 900 ? latestRecord.position : latestRecord?.dfPosition || null;
  };
  
  // ✅ Use ONLY GSC data for position calculations (filter out 999 defaults)
  const gscPositions = keyword.history
    .filter(h => h.position < 900)
    .map(h => h.position);
  
  const currentPosition = getCurrentPosition();
  const bestPosition = gscPositions.length > 0 ? Math.min(...gscPositions) : null;
  const worstPosition = gscPositions.length > 0 ? Math.max(...gscPositions) : null;

  // Calculate 90d change using ONLY GSC data (oldest vs newest GSC record)
  const gscRecords = keyword.history.filter(h => h.position < 900);
  const change90d = gscRecords.length >= 2
    ? gscRecords[gscRecords.length - 1].position - gscRecords[0].position
    : null;

  // Prepare chart data (reverse for chronological order)
  // Only show GSC data in chart (filter out 999 defaults)
  const chartData = [...keyword.history]
    .filter(h => h.position < 900)  // ✅ Only real GSC data
    .reverse()
    .map((h) => ({
      date: new Date(h.date).toISOString().split('T')[0],
      position: h.position,
      clicks: h.clicks,
      impressions: h.impressions,
    }));

  // Total metrics (only from real GSC data)
  const totalClicks = gscRecords.reduce((sum, h) => sum + h.clicks, 0);
  const totalImpressions = gscRecords.reduce((sum, h) => sum + h.impressions, 0);
  const avgCTR = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  const renderChangeIndicator = (change: number | null, label: string) => {
    if (change === null || change === undefined) {
      return <span style={{ color: '#9ca3af' }}>-</span>;
    }

    const color = change > 0 ? '#10b981' : change < 0 ? '#ef4444' : '#6b7280';
    const icon = change > 0 ? '↑' : change < 0 ? '↓' : '→';

    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{label}</div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
            color,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {icon}{Math.abs(change).toFixed(1)}
        </div>
      </div>
    );
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
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff',
          padding: 32,
          borderRadius: 16,
          maxWidth: 900,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0, marginBottom: 8, color: '#111827' }}>
              {keyword.keyword}
            </h2>
            {keyword.targetUrl && (
              <a
                href={keyword.targetUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 14,
                  color: '#3b82f6',
                  textDecoration: 'none',
                }}
              >
                {keyword.targetUrl}
              </a>
            )}
            {keyword.tags.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {keyword.tags.map((tag, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '4px 10px',
                      background: '#eff6ff',
                      color: '#1e40af',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: 28,
              cursor: 'pointer',
              color: '#6b7280',
              padding: 0,
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>

        {/* Data Sources Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          {/* GSC Data */}
          <div
            style={{
              background: '#eff6ff',
              padding: 20,
              borderRadius: 12,
              border: '1px solid #bfdbfe',
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#1e40af' }}>
              GSC Rank (Historical Average)
            </h3>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
              {latestRecord?.position && latestRecord.position < 900 ? `#${latestRecord.position.toFixed(1)}` : '-'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              Clicks: {latestRecord?.clicks || 0} | Impressions: {latestRecord?.impressions || 0}
            </div>
          </div>

          {/* SERP Data */}
          <div
            style={{
              background: '#f0fdf4',
              padding: 20,
              borderRadius: 12,
              border: '1px solid #86efac',
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#166534' }}>
              SERP Rank (Live Check)
            </h3>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
              {latestRecord?.dfPosition ? `#${latestRecord.dfPosition.toFixed(1)}` : '-'}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>
              {latestRecord?.dfLastChecked 
                ? `Last checked: ${new Date(latestRecord.dfLastChecked).toLocaleDateString('da-DK', { month: 'short', day: 'numeric' })}`
                : 'Not checked yet'}
            </div>
          </div>
        </div>

        {/* Position Stats */}
        <div
          style={{
            background: '#f9fafb',
            padding: 20,
            borderRadius: 12,
            marginBottom: 24,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#374151' }}>
            Position Stats
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Best Ever</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}>
                {bestPosition ? `#${bestPosition.toFixed(1)}` : '-'}
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Worst</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444' }}>
                {worstPosition ? `#${worstPosition.toFixed(1)}` : '-'}
              </div>
            </div>
            {renderChangeIndicator(keyword.change7d, '7d Change')}
            {renderChangeIndicator(keyword.change30d, '30d Change')}
            {renderChangeIndicator(change90d, '90d Change')}
          </div>
        </div>

        {/* GSC Metrics */}
        <div
          style={{
            background: '#fff',
            padding: 20,
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            marginBottom: 24,
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#374151' }}>
            GSC Metrics (Last {keyword.history.length} days)
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Total Clicks</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>
                {totalClicks.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Total Impressions</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>
                {totalImpressions.toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>Avg CTR</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>
                {avgCTR.toFixed(2)}%
              </div>
            </div>
          </div>
        </div>

        {/* Position History Chart */}
        {chartData.length > 0 && (
          <div
            style={{
              background: '#fff',
              padding: 20,
              borderRadius: 12,
              border: '1px solid #e5e7eb',
            }}
          >
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: '#374151' }}>
              Position History ({chartData.length} days)
            </h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString('da-DK', { month: 'short', day: 'numeric' });
                  }}
                />
                <YAxis
                  reversed
                  domain={[1, 'auto']}
                  tick={{ fontSize: 11, fill: '#6b7280' }}
                  label={{ value: 'Position', angle: -90, position: 'insideLeft', style: { fill: '#6b7280', fontSize: 11 } }}
                />
                <Tooltip
                  contentStyle={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleDateString('da-DK', { 
                      weekday: 'short',
                      month: 'short', 
                      day: 'numeric' 
                    });
                  }}
                  formatter={(value: any, name: string) => {
                    if (name === 'position') {
                      return [`#${value.toFixed(1)}`, 'Position'];
                    }
                    if (name === 'clicks') {
                      return [value.toLocaleString(), 'Clicks'];
                    }
                    if (name === 'impressions') {
                      return [value.toLocaleString(), 'Impressions'];
                    }
                    return [value, name];
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="position"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', r: 3 }}
                  activeDot={{ r: 5 }}
                  name="position"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, paddingTop: 20, borderTop: '1px solid #e5e7eb' }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              background: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

