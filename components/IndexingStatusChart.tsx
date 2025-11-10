'use client';

import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { STATUS_META, IndexingStatus } from './IndexingSummaryCards';

export interface IndexingDailyBreakdown {
  date: string;
  submitted_indexed: number;
  crawled_not_indexed: number;
  discovered_not_indexed: number;
  unknown: number;
}

interface IndexingStatusChartProps {
  data: IndexingDailyBreakdown[];
  statusFilter: IndexingStatus | null;
}

const STATUS_ORDER: IndexingStatus[] = [
  'submitted_indexed',
  'crawled_not_indexed',
  'discovered_not_indexed',
  'unknown',
];

export default function IndexingStatusChart({ data, statusFilter }: IndexingStatusChartProps) {
  return (
    <div
      style={{
        padding: 24,
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #e2e8f0',
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>Indexing Status Trend</h2>
          <p style={{ margin: '6px 0 0', color: '#64748b', fontSize: 13 }}>
            Daily distribution of indexing statuses within the selected date range.
          </p>
        </div>
      </div>
      <div style={{ width: '100%', height: 320 }}>
        <ResponsiveContainer>
          <BarChart data={data} stackOffset="expand">
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#475569' }}
              tickMargin={8}
            />
            <YAxis
              tickFormatter={(value) => `${Math.round(value * 100)}%`}
              tick={{ fontSize: 12, fill: '#475569' }}
            />
            <Tooltip
              formatter={(value: number, name: string) => {
                const statusKey = name as IndexingStatus;
                const meta = STATUS_META[statusKey];
                return [`${Math.round(value * 100)}%`, meta.label];
              }}
              labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            />
            <Legend
              formatter={(value) => STATUS_META[value as IndexingStatus].label}
              wrapperStyle={{ fontSize: 12 }}
            />
            {STATUS_ORDER.filter((status) => !statusFilter || status === statusFilter).map((status) => (
              <Bar
                key={status}
                dataKey={status}
                stackId="indexing"
                fill={STATUS_META[status].color}
                opacity={!statusFilter || status === statusFilter ? 0.85 : 0.35}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}


