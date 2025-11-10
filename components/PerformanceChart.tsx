'use client';

import { useRouter } from 'next/navigation';
import {
  LineChart,
  Line,
  Area,
  AreaChart,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import ChartTooltip from './ChartTooltip';
import GoogleLogo from './GoogleLogo';

interface DataPoint {
  date: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface Annotation {
  id: string;
  date: string;
  title: string;
  description: string;
}

export interface GoogleUpdate {
  id: string;
  date: string;
  completionDate?: string;
  name: string;
  type: string;
  description: string;
  source: string;
}

interface PerformanceChartProps {
  data: DataPoint[];
  compareData?: DataPoint[];
  selectedMetrics?: string[];
  dateRange?: { startDate: string; endDate: string };
  compareRange?: { startDate: string; endDate: string } | null;
  metricCheckboxes?: React.ReactNode;
  annotations?: Annotation[];
  googleUpdates?: GoogleUpdate[];
  onDateClick?: (date: string) => void;
  onDeleteAnnotation?: (annotationId: string) => void;
  siteUrl?: string;
}

export default function PerformanceChart({ 
  data, 
  compareData, 
  selectedMetrics = ['clicks', 'impressions', 'ctr', 'position'], 
  dateRange, 
  compareRange,
  metricCheckboxes,
  annotations = [],
  googleUpdates = [],
  onDateClick,
  onDeleteAnnotation,
  siteUrl,
}: PerformanceChartProps) {
  const router = useRouter();
  // Sort data by date
  const sortedCurrentData = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const sortedCompareData = compareData ? [...compareData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) : null;

  // Create chart data - use current period dates as base, align comparison by index
  const chartData = sortedCurrentData.map((current, index) => {
    // For comparison data, align by index (day 1 vs day 1, day 2 vs day 2, etc.)
    const compare = sortedCompareData && sortedCompareData.length > index ? sortedCompareData[index] : null;

    return {
      date: new Date(current.date).toLocaleDateString('da-DK', { month: 'short', day: 'numeric' }),
      dateFull: current.date, // Store full date for tooltip
      compareDateFull: compare?.date || null, // Store comparison date for tooltip
      Clicks: current.clicks || 0,
      'Clicks (Compare)': compare?.clicks ?? null,
      Impressions: current.impressions || 0,
      'Impressions (Compare)': compare?.impressions ?? null,
      CTR: current.ctr ? parseFloat((current.ctr * 100).toFixed(2)) : 0,
      'CTR (Compare)': compare?.ctr ? parseFloat((compare.ctr * 100).toFixed(2)) : null,
      Position: current.position ? parseFloat(current.position.toFixed(2)) : 0,
      'Position (Compare)': compare?.position ? parseFloat(compare.position.toFixed(2)) : null,
    };
  });

  // Determine which metrics to show
  const showClicks = selectedMetrics.includes('clicks');
  const showImpressions = selectedMetrics.includes('impressions');
  const showCTR = selectedMetrics.includes('ctr');
  const showPosition = selectedMetrics.includes('position');

  // Calculate max values for each metric to set appropriate Y-axis scales
  const maxClicks = Math.max(
    ...chartData.map((d) => Math.max(d.Clicks || 0, d['Clicks (Compare)'] || 0)),
    10
  );
  const maxImpressions = Math.max(
    ...chartData.map((d) => Math.max(d.Impressions || 0, d['Impressions (Compare)'] || 0)),
    100
  );
  const maxCTR = Math.max(
    ...chartData.map((d) => Math.max(d.CTR || 0, d['CTR (Compare)'] || 0)),
    5
  );
  const maxPosition = Math.max(
    ...chartData.map((d) => Math.max(d.Position || 0, d['Position (Compare)'] || 0)),
    50
  );

  // Determine which Y-axis to use for each metric
  // Each metric gets its own axis with appropriate scale:
  // - Clicks: left axis (small scale: 0-15)
  // - Impressions: right axis (large scale: 0-3.2k)
  // - CTR: right axis (small scale: 0-5%)
  // - Position: right axis (small scale: 0-50)
  // When multiple metrics share the right axis, we prioritize impressions scale
  // but will need to use multiple right axes or overlay approach
  
  const hasLeftAxis = showClicks;
  const hasRightAxis = showImpressions || showCTR || showPosition;
  
  // Calculate appropriate scales for each metric
  const clicksDomain = hasLeftAxis ? [0, Math.max(maxClicks * 1.1, 10)] : undefined;
  const impressionsDomain = showImpressions ? [0, Math.max(maxImpressions * 1.1, 100)] : undefined;
  const ctrDomain = showCTR ? [0, Math.max(maxCTR * 1.1, 5)] : undefined;
  const positionDomain = showPosition ? [0, Math.max(maxPosition * 1.1, 50)] : undefined;
  
  // For right axis: if impressions is shown, use its scale (it's the largest)
  // Otherwise use CTR or Position scale
  // But we need separate axes for CTR and Position when Impressions is also shown
  const impressionsRightDomain = showImpressions ? impressionsDomain : undefined;
  const ctrRightDomain = showCTR && !showImpressions ? ctrDomain : undefined;
  const positionRightDomain = showPosition && !showImpressions && !showCTR ? positionDomain : undefined;
  
  // If we have CTR or Position with Impressions, we need a third axis
  // Recharts supports multiple Y-axes, so we can use right2 for CTR/Position
  const needsThirdAxis = (showCTR || showPosition) && showImpressions;

  // Create annotation markers map
  const annotationsByDate = new Map(
    annotations.map((ann) => [ann.date, ann])
  );

  // Create Google updates map
  const googleUpdatesByDate = new Map(
    googleUpdates.map((update) => [update.date, update])
  );

  const handleChartClick = (data: any) => {
    if (data && data.activePayload && data.activePayload[0]) {
      const clickedDate = data.activePayload[0].payload.dateFull;
      if (clickedDate && onDateClick) {
        onDateClick(clickedDate);
      }
    }
  };

  return (
    <div style={{ marginBottom: 32, marginTop: 24 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#FFFFFF' }}>
          Performance Over Time
          {onDateClick && (
            <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255, 255, 255, 0.5)', marginLeft: 12 }}>
              💡 Click on the chart to add an annotation
            </span>
          )}
        </h2>
        {metricCheckboxes && <div>{metricCheckboxes}</div>}
      </div>
      <div style={{ background: 'rgba(255, 255, 255, 0.06)', borderRadius: 12, border: '1px solid rgba(255, 255, 255, 0.1)', overflow: 'visible', position: 'relative' }}>
        <div style={{ width: '100%', height: 400, padding: 16, position: 'relative' }}>
          {/* Annotation markers - subtle dashed vertical lines within chart area only */}
          {annotations.length > 0 && (
            <div style={{ position: 'absolute', top: 16, left: 56, right: 76, bottom: 30, pointerEvents: 'none', zIndex: 5 }}>
              {sortedCurrentData.map((point, index) => {
                const annotation = annotationsByDate.get(point.date);
                if (!annotation) return null;
                
                const xPercent = (index / (sortedCurrentData.length - 1)) * 100;
                
                return (
                  <div
                    key={annotation.id}
                    style={{
                      position: 'absolute',
                      left: `${xPercent}%`,
                      top: 0,
                      height: '100%',
                      transform: 'translateX(-50%)',
                    }}
                  >
                    <div
                      style={{
                        width: 1,
                        height: '100%',
                        borderLeft: '1px dashed #94a3b8',
                        opacity: 0.5,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ left: 20, right: 60 }} onClick={handleChartClick} style={{ cursor: onDateClick ? 'pointer' : 'default' }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            {hasLeftAxis && (
              <YAxis
                yAxisId="left"
                domain={clicksDomain}
                tickFormatter={(value) => value.toString()}
                label={{ value: 'Clicks', angle: -90, position: 'insideLeft' }}
              />
            )}
            {showImpressions && (
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={impressionsRightDomain}
                tickFormatter={(value) => {
                  if (value >= 1000) {
                    return `${(value / 1000).toFixed(1)}k`;
                  }
                  return value.toString();
                }}
                label={{ 
                  value: 'Impressions', 
                  angle: 90, 
                  position: 'insideRight' 
                }}
              />
            )}
            {needsThirdAxis && showCTR && (
              <YAxis
                yAxisId="right2"
                orientation="right"
                domain={ctrDomain}
                tickFormatter={(value) => `${value.toFixed(1)}%`}
                style={{ opacity: 0 }}
                width={0}
              />
            )}
            {needsThirdAxis && showPosition && !showCTR && (
              <YAxis
                yAxisId="right2"
                orientation="right"
                domain={positionDomain}
                tickFormatter={(value) => value.toFixed(0)}
                style={{ opacity: 0 }}
                width={0}
              />
            )}
            {needsThirdAxis && showPosition && showCTR && (
              <YAxis
                yAxisId="right3"
                orientation="right"
                domain={positionDomain}
                tickFormatter={(value) => value.toFixed(0)}
                style={{ opacity: 0 }}
                width={0}
              />
            )}
            {!showImpressions && showCTR && (
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={ctrRightDomain}
                tickFormatter={(value) => `${value.toFixed(1)}%`}
                label={{ 
                  value: 'CTR', 
                  angle: 90, 
                  position: 'insideRight' 
                }}
              />
            )}
            {!showImpressions && !showCTR && showPosition && (
              <YAxis
                yAxisId="right"
                orientation="right"
                domain={positionRightDomain}
                tickFormatter={(value) => value.toFixed(0)}
                label={{ 
                  value: 'Position', 
                  angle: 90, 
                  position: 'insideRight' 
                }}
              />
            )}
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                
                // Find comparison data for the same date
                const currentData = payload.find((p: any) => !p.dataKey?.includes('Compare'));
                const compareData = payload.find((p: any) => p.dataKey?.includes('Compare'));
                
                // Find the actual date from chartData
                const chartDataPoint = chartData.find((d: any) => d.date === label);
                if (!chartDataPoint) return null;
                
                // Use the stored full dates from chartData
                const currentDate = new Date(chartDataPoint.dateFull);
                const compareDate = chartDataPoint.compareDateFull ? new Date(chartDataPoint.compareDateFull) : null;
                
                const formatDate = (date: Date) => {
                  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                  return `${days[date.getDay()]} · ${date.getFullYear()} ${months[date.getMonth()]} ${date.getDate()}`;
                };
                
                const getMetricValue = (dataKey: string) => {
                  const item = payload.find((p: any) => p.dataKey === dataKey);
                  return item?.value ?? null;
                };
                
                const calculateChange = (current: number | null, previous: number | null) => {
                  if (current === null || previous === null || previous === 0) return null;
                  const changePercent = ((current - previous) / previous) * 100;
                  const changeAbs = current - previous;
                  return { percent: changePercent, absolute: changeAbs };
                };
                
                const formatValue = (value: number | null, metric: string) => {
                  if (value === null) return '-';
                  if (metric === 'CTR' || metric === 'CTR (Compare)') {
                    return `${value.toFixed(2)}%`;
                  }
                  if (metric === 'Position' || metric === 'Position (Compare)') {
                    return value.toFixed(1);
                  }
                  if (metric === 'Impressions' || metric === 'Impressions (Compare)') {
                    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
                    return value.toLocaleString();
                  }
                  return value.toLocaleString();
                };
                
                const metrics = [
                  { key: 'Clicks', compareKey: 'Clicks (Compare)', color: '#2563eb', label: 'Clicks' },
                  { key: 'Impressions', compareKey: 'Impressions (Compare)', color: '#7c3aed', label: 'Impressions' },
                  { key: 'CTR', compareKey: 'CTR (Compare)', color: '#059669', label: 'CTR' },
                  { key: 'Position', compareKey: 'Position (Compare)', color: '#ea580c', label: 'Avg. Position' },
                ];
                
                return (
                  <div
                    style={{
                      background: '#fff',
                      border: '1px solid #e5e7eb',
                      borderRadius: 8,
                      padding: 16,
                      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                      minWidth: 300,
                    }}
                  >
                    <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>
                          {formatDate(currentDate)}
                        </div>
                        {compareDate && (
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#6b7280', marginTop: 8 }}>
                            {formatDate(compareDate)}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {metrics.map((metric) => {
                        const currentValue = getMetricValue(metric.key);
                        const compareValue = compareData ? getMetricValue(metric.compareKey) : null;
                        const change = calculateChange(currentValue, compareValue);
                        
                        if (currentValue === null && compareValue === null) return null;
                        
                        return (
                          <div key={metric.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: metric.color,
                                flexShrink: 0,
                              }}
                            />
                            <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 14, fontWeight: 500 }}>{metric.label}</span>
                              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                                <span style={{ fontSize: 14, fontWeight: 600 }}>
                                  {formatValue(currentValue, metric.key)}
                                </span>
                                {change && (
                                  <div
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 600,
                                      color: change.percent > 0 ? '#059669' : '#dc2626',
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      minWidth: 60,
                                      justifyContent: 'flex-end',
                                    }}
                                  >
                                    <span>{change.percent > 0 ? '↑' : '↓'}</span>
                                    {metric.key === 'Position' || metric.key === 'Avg. Position' ? (
                                      <span>{Math.abs(change.absolute).toFixed(1)}</span>
                                    ) : (
                                      <span>{Math.abs(change.percent).toFixed(1)}%</span>
                                    )}
                                  </div>
                                )}
                                {compareValue !== null && (
                                  <span style={{ fontSize: 14, fontWeight: 600, color: '#6b7280', minWidth: 60, textAlign: 'right' }}>
                                    {formatValue(compareValue, metric.compareKey)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              }}
            />
            <Legend />
            {showClicks && (
              <>
                <Area
                  yAxisId="left"
                  type="linear"
                  dataKey="Clicks"
                  stroke="#2563eb"
                  fill="#2563eb"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  dot={false}
                  name="Clicks"
                />
                {compareData && (
                  <Line
                    yAxisId="left"
                    type="linear"
                    dataKey="Clicks (Compare)"
                    stroke="#2563eb"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    strokeOpacity={0.6}
                    dot={false}
                    connectNulls={false}
                    name="Clicks (Compare)"
                  />
                )}
              </>
            )}
            {showImpressions && (
              <>
                <Area
                  yAxisId="right"
                  type="linear"
                  dataKey="Impressions"
                  stroke="#7c3aed"
                  fill="#7c3aed"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  dot={false}
                  name="Impressions"
                />
                {compareData && (
                  <Line
                    yAxisId="right"
                    type="linear"
                    dataKey="Impressions (Compare)"
                    stroke="#7c3aed"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    strokeOpacity={0.6}
                    dot={false}
                    connectNulls={false}
                    name="Impressions (Compare)"
                  />
                )}
              </>
            )}
            {showCTR && (
              <>
                <Area
                  yAxisId={showImpressions ? "right2" : "right"}
                  type="linear"
                  dataKey="CTR"
                  stroke="#059669"
                  fill="#059669"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  dot={false}
                  name="CTR"
                />
                {compareData && (
                  <Line
                    yAxisId={showImpressions ? "right2" : "right"}
                    type="linear"
                    dataKey="CTR (Compare)"
                    stroke="#059669"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    strokeOpacity={0.6}
                    dot={false}
                    connectNulls={false}
                    name="CTR (Compare)"
                  />
                )}
              </>
            )}
            {showPosition && (
              <>
                <Area
                  yAxisId={showImpressions && showCTR ? "right3" : (showImpressions || showCTR ? "right2" : "right")}
                  type="linear"
                  dataKey="Position"
                  stroke="#ea580c"
                  fill="#ea580c"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  dot={false}
                  name="Position"
                />
                {compareData && (
                  <Line
                    yAxisId={showImpressions && showCTR ? "right3" : (showImpressions || showCTR ? "right2" : "right")}
                    type="linear"
                    dataKey="Position (Compare)"
                    stroke="#ea580c"
                    strokeWidth={1.5}
                    strokeDasharray="5 5"
                    strokeOpacity={0.6}
                    dot={false}
                    connectNulls={false}
                    name="Position (Compare)"
                  />
                )}
              </>
            )}
          </ComposedChart>
        </ResponsiveContainer>
        
          {/* Indicator badges positioned on X-axis area */}
          <div style={{ position: 'absolute', left: 56, right: 76, bottom: 0, height: 30, pointerEvents: 'none' }}>
            {/* Annotation badges */}
            {annotations.length > 0 && sortedCurrentData.map((point, index) => {
              const annotation = annotationsByDate.get(point.date);
              if (!annotation) return null;
              
              const xPercent = (index / (sortedCurrentData.length - 1)) * 100;
              
              return (
                <div
                  key={`badge-${annotation.id}`}
                  style={{
                    position: 'absolute',
                    left: `${xPercent}%`,
                    bottom: 0,
                    transform: 'translateX(-50%)',
                    pointerEvents: 'auto',
                  }}
                >
                  <ChartTooltip
                    content={
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', marginBottom: 4 }}>
                          {annotation.title}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                          {new Date(annotation.date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })} • Note
                        </div>
                        {annotation.description && (
                          <div style={{ fontSize: 13, color: '#475569', marginBottom: 12 }}>
                            {annotation.description}
                          </div>
                        )}
                        <button
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            if (siteUrl) {
                              router.push(`/dashboard/annotations?site=${encodeURIComponent(siteUrl)}`);
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            borderRadius: 6,
                            border: '1px solid #cbd5e1',
                            background: '#fff',
                            color: '#2563eb',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                            width: '100%',
                          }}
                        >
                          View in Annotations →
                        </button>
                      </div>
                    }
                  >
                    <span
                      style={{
                        fontSize: 16,
                        cursor: 'pointer',
                        display: 'inline-block',
                        lineHeight: 1,
                      }}
                      title={annotation.title}
                    >
                      📌
                    </span>
                  </ChartTooltip>
                </div>
              );
            })}
            
            {/* Google update indicators */}
            {googleUpdates.length > 0 && sortedCurrentData.map((point, index) => {
              const update = googleUpdatesByDate.get(point.date);
              if (!update) return null;
              
              const xPercent = (index / (sortedCurrentData.length - 1)) * 100;
              
              return (
                <div
                  key={`update-${update.id}`}
                  style={{
                    position: 'absolute',
                    left: `${xPercent}%`,
                    bottom: 0,
                    transform: 'translateX(-50%)',
                    pointerEvents: 'auto',
                  }}
                >
                  <ChartTooltip
                    content={
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a', marginBottom: 4 }}>
                          {update.name}
                        </div>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>
                          {new Date(update.date).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })} • {update.source}
                        </div>
                        <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                          {update.description}
                        </div>
                        {update.completionDate && (
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 8 }}>
                            Completed: {new Date(update.completionDate).toLocaleDateString('en-US', { 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                          </div>
                        )}
                      </div>
                    }
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        background: '#fff',
                        cursor: 'pointer',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                        transition: 'transform 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                      }}
                      title={update.name}
                    >
                      <GoogleLogo size={14} />
                    </div>
                  </ChartTooltip>
                </div>
              );
            })}
          </div>
        </div>


      </div>
    </div>
  );
}

