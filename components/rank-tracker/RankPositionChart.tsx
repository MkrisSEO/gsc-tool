import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface RankPositionChartProps {
  data: Array<{
    date: string;
    avgPosition: number;
    clicks: number;
    impressions: number;
    keywordCount: number;
  }>;
}

export default function RankPositionChart({ data }: RankPositionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          background: '#fff',
          padding: 24,
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          marginBottom: 24,
          textAlign: 'center',
          color: '#6b7280',
        }}
      >
        <p>No historical data yet. Add keywords and sync GSC data to see trends.</p>
      </div>
    );
  }

  return (
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
        Average Position Trend ({data.length} days)
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return date.toLocaleDateString('da-DK', { month: 'short', day: 'numeric' });
            }}
          />
          <YAxis
            reversed
            domain={[1, 100]}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            label={{ value: 'Position', angle: -90, position: 'insideLeft', style: { fill: '#6b7280', fontSize: 12 } }}
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
                year: 'numeric', 
                month: 'short', 
                day: 'numeric' 
              });
            }}
            formatter={(value: any, name: string) => {
              if (name === 'avgPosition') {
                return [value.toFixed(1), 'Avg Position'];
              }
              if (name === 'clicks') {
                return [value.toLocaleString(), 'Clicks'];
              }
              if (name === 'impressions') {
                return [value.toLocaleString(), 'Impressions'];
              }
              if (name === 'keywordCount') {
                return [value, 'Keywords'];
              }
              return [value, name];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="avgPosition"
            stroke="#3b82f6"
            strokeWidth={3}
            dot={{ fill: '#3b82f6', r: 4 }}
            activeDot={{ r: 6 }}
            name="Avg Position"
          />
        </LineChart>
      </ResponsiveContainer>

      <div
        style={{
          marginTop: 16,
          padding: 12,
          background: '#f9fafb',
          borderRadius: 8,
          fontSize: 13,
          color: '#6b7280',
        }}
      >
        💡 Lower position numbers are better (Position #1 is the best). Chart shows average position across all tracked keywords.
      </div>
    </div>
  );
}

