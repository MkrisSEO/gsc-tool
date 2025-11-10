'use client';

import { useState, useMemo } from 'react';

interface OrganicPositionsChartProps {
  data: Array<{
    date: string;
    position1to3: number;
    position4to10: number;
    position11to20: number;
    position21plus: number;
  }>;
  compareData?: Array<{
    date: string;
    position1to3: number;
    position4to10: number;
    position11to20: number;
    position21plus: number;
  }>;
  dateRange: { startDate: string; endDate: string };
  compareRange?: { startDate: string; endDate: string } | null;
}

const POSITION_FILTERS = [
  { key: 'position1to3', label: '1-3', color: '#fbbf24', defaultActive: true }, // Yellow/gold
  { key: 'position4to10', label: '4-10', color: '#7c3aed', defaultActive: true }, // Dark purple
  { key: 'position11to20', label: '11-20', color: '#a78bfa', defaultActive: true }, // Medium purple
  { key: 'position21plus', label: '21+', color: '#c4b5fd', defaultActive: true }, // Light purple
];

export default function OrganicPositionsChart({
  data,
  compareData,
  dateRange,
  compareRange,
}: OrganicPositionsChartProps) {
  const [activeFilters, setActiveFilters] = useState<Set<string>>(
    new Set(POSITION_FILTERS.map(f => f.key))
  );
  const [isStackedView, setIsStackedView] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const toggleFilter = (key: string) => {
    const newFilters = new Set(activeFilters);
    if (newFilters.has(key)) {
      newFilters.delete(key);
    } else {
      newFilters.add(key);
    }
    setActiveFilters(newFilters);
  };

  // Calculate comparison percentages
  const comparisonPercentages = useMemo(() => {
    if (!compareData || compareData.length === 0) return null;

    const currentTotals = {
      position1to3: 0,
      position4to10: 0,
      position11to20: 0,
      position21plus: 0,
    };
    const compareTotals = {
      position1to3: 0,
      position4to10: 0,
      position11to20: 0,
      position21plus: 0,
    };

    data.forEach(d => {
      currentTotals.position1to3 += d.position1to3;
      currentTotals.position4to10 += d.position4to10;
      currentTotals.position11to20 += d.position11to20;
      currentTotals.position21plus += d.position21plus;
    });

    compareData.forEach(d => {
      compareTotals.position1to3 += d.position1to3;
      compareTotals.position4to10 += d.position4to10;
      compareTotals.position11to20 += d.position11to20;
      compareTotals.position21plus += d.position21plus;
    });

    return {
      position1to3: compareTotals.position1to3 > 0 
        ? ((currentTotals.position1to3 - compareTotals.position1to3) / compareTotals.position1to3) * 100 
        : 0,
      position4to10: compareTotals.position4to10 > 0 
        ? ((currentTotals.position4to10 - compareTotals.position4to10) / compareTotals.position4to10) * 100 
        : 0,
      position11to20: compareTotals.position11to20 > 0 
        ? ((currentTotals.position11to20 - compareTotals.position11to20) / compareTotals.position11to20) * 100 
        : 0,
      position21plus: compareTotals.position21plus > 0 
        ? ((currentTotals.position21plus - compareTotals.position21plus) / compareTotals.position21plus) * 100 
        : 0,
    };
  }, [data, compareData]);

  // Validate minimum data requirements
  const hasMinimumData = useMemo(() => {
    const totalQueries = data.reduce((sum, d) => 
      sum + d.position1to3 + d.position4to10 + d.position11to20 + d.position21plus, 0
    );
    const uniqueDays = new Set(data.map(d => d.date)).size;
    
    // ✅ If we have filtered data (1 day snapshot), show it anyway
    if (uniqueDays === 1 && totalQueries >= 10) {
      return true; // Allow single day snapshot when filtered
    }
    
    return totalQueries >= 10 && uniqueDays >= 14;
  }, [data]);

  // Calculate chart dimensions and scales
  const chartWidth = 1200;
  const chartHeight = 350;
  const padding = { top: 20, right: 40, bottom: 40, left: 70 };
  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  // Prepare data for chart
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    return data.map(d => {
      const total: any = { date: d.date };
      let cumulativeSum = 0;
      
      // Process in reverse order for stacking (21+ at bottom, 1-3 at top)
      const reversedFilters = [...POSITION_FILTERS].reverse();
      reversedFilters.forEach(filter => {
        if (activeFilters.has(filter.key)) {
          const value = (d as any)[filter.key] || 0;
          total[`${filter.key}_start`] = cumulativeSum;
          cumulativeSum += value;
          total[`${filter.key}_end`] = cumulativeSum;
          total[filter.key] = value;
        }
      });
      total.max = cumulativeSum;
      return total;
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data, activeFilters]);

  const maxValue = useMemo(() => {
    if (isStackedView) {
      return Math.max(...chartData.map(d => d.max || 0), 1);
    } else {
      let max = 0;
      chartData.forEach(d => {
        POSITION_FILTERS.forEach(filter => {
          if (activeFilters.has(filter.key)) {
            max = Math.max(max, d[filter.key] || 0);
          }
        });
      });
      return Math.max(max, 1);
    }
  }, [chartData, activeFilters, isStackedView]);

  // Generate X scale (time)
  const xScale = (index: number) => {
    return (index / Math.max(chartData.length - 1, 1)) * innerWidth;
  };

  // Generate Y scale
  const yScale = (value: number) => {
    return innerHeight - (value / maxValue) * innerHeight;
  };

  // Generate path for stacked area
  const generateAreaPath = (key: string) => {
    if (chartData.length === 0) return '';
    
    let pathTop = `M ${xScale(0)} ${yScale(chartData[0][`${key}_end`] || 0)}`;
    for (let i = 1; i < chartData.length; i++) {
      pathTop += ` L ${xScale(i)} ${yScale(chartData[i][`${key}_end`] || 0)}`;
    }
    
    let pathBottom = `L ${xScale(chartData.length - 1)} ${yScale(chartData[chartData.length - 1][`${key}_start`] || 0)}`;
    for (let i = chartData.length - 2; i >= 0; i--) {
      pathBottom += ` L ${xScale(i)} ${yScale(chartData[i][`${key}_start`] || 0)}`;
    }
    
    return pathTop + pathBottom + ' Z';
  };

  // Generate path for line chart
  const generateLinePath = (key: string) => {
    if (chartData.length === 0) return '';
    
    let path = `M ${xScale(0)} ${yScale(chartData[0][key] || 0)}`;
    for (let i = 1; i < chartData.length; i++) {
      path += ` L ${xScale(i)} ${yScale(chartData[i][key] || 0)}`;
    }
    
    return path;
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Format date for tooltip
  const formatDateLong = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  // Generate Y-axis labels
  const yAxisLabels = useMemo(() => {
    const numLabels = 5;
    const step = maxValue / (numLabels - 1);
    return Array.from({ length: numLabels }, (_, i) => Math.round(step * i));
  }, [maxValue]);

  // Format percentage change
  const formatPercentage = (value: number) => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${Math.round(value)}%`;
  };

  // Get percentage color
  const getPercentageColor = (value: number) => {
    if (value > 0) return '#059669'; // Green
    if (value < 0) return '#dc2626'; // Red
    return '#6b7280'; // Gray
  };

  // Show date range
  const dateRangeText = useMemo(() => {
    if (!dateRange.startDate || !dateRange.endDate) return '';
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  }, [dateRange]);

  // Debug: Log data issues
  const debugInfo = useMemo(() => {
    const totalQueries = data.reduce((sum, d) => 
      sum + d.position1to3 + d.position4to10 + d.position11to20 + d.position21plus, 0
    );
    const uniqueDays = new Set(data.map(d => d.date)).size;
    const datesWithZeroQueries = data.filter(d => 
      d.position1to3 + d.position4to10 + d.position11to20 + d.position21plus === 0
    ).length;
    
    return { totalQueries, uniqueDays, datesWithZeroQueries, dataPoints: data.length };
  }, [data]);

  // Get latest day's data for summary display (MOVED BEFORE EARLY RETURN)
  const totalSummary = useMemo(() => {
    if (data.length === 0) return { position1to3: 0, position4to10: 0, position11to20: 0, position21plus: 0, date: '' };
    
    // Sort by date and get the most recent day
    const sortedData = [...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latestDay = sortedData[0];
    
    return {
      position1to3: latestDay.position1to3,
      position4to10: latestDay.position4to10,
      position11to20: latestDay.position11to20,
      position21plus: latestDay.position21plus,
      date: latestDay.date,
    };
  }, [data]);

  const grandTotal = totalSummary.position1to3 + totalSummary.position4to10 + 
                     totalSummary.position11to20 + totalSummary.position21plus;
  
  // Format the latest date for display (MOVED BEFORE EARLY RETURN)
  const latestDateFormatted = useMemo(() => {
    if (!totalSummary.date) return '';
    const date = new Date(totalSummary.date);
    return date.toLocaleDateString('da-DK', { day: 'numeric', month: 'short', year: 'numeric' });
  }, [totalSummary.date]);

  if (!hasMinimumData) {
    return (
      <div style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0, marginBottom: 16 }}>Query Counting</h2>
        <div
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 40,
            textAlign: 'center',
          }}
        >
          <p style={{ color: '#6b7280', margin: 0 }}>
            Not enough data - minimum 10 queries and 2 weeks of history required
          </p>
          <p style={{ color: '#9ca3af', fontSize: 12, marginTop: 8 }}>
            Debug: {debugInfo.totalQueries} total queries, {debugInfo.uniqueDays} unique days, {debugInfo.dataPoints} data points
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: '#FFFFFF' }}>Query Counting</h2>
        </div>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            fontSize: 14,
            color: 'rgba(255, 255, 255, 0.8)',
          }}
        >
          <input
            type="checkbox"
            checked={isStackedView}
            onChange={(e) => setIsStackedView(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <span>Stacked View</span>
        </label>
      </div>

      {/* Summary Stats - Large Display */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(5, 1fr)', 
        gap: 16, 
        marginBottom: 24 
      }}>
        {POSITION_FILTERS.map(filter => {
          const count = (totalSummary as any)[filter.key] || 0;
          const percentage = grandTotal > 0 ? ((count / grandTotal) * 100).toFixed(1) : '0.0';
          return (
            <div
              key={filter.key}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 12,
                padding: '20px 16px',
                textAlign: 'center',
                transition: 'all 0.3s',
              }}
            >
              <div style={{ 
                fontSize: 11, 
                color: 'rgba(255, 255, 255, 0.7)', 
                marginBottom: 10, 
                fontWeight: 600,
                letterSpacing: '0.5px',
                textTransform: 'uppercase'
              }}>
                Position {filter.label}
              </div>
              <div style={{ 
                fontSize: 32, 
                fontWeight: 700, 
                color: filter.color,
                marginBottom: 6,
                lineHeight: 1
              }}>
                {count.toLocaleString()}
              </div>
              <div style={{ 
                fontSize: 11, 
                color: 'rgba(255, 255, 255, 0.5)',
                fontWeight: 500
              }}>
                {percentage}% • {latestDateFormatted}
              </div>
            </div>
          );
        })}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(0, 113, 227, 0.15) 0%, rgba(59, 130, 246, 0.1) 100%)',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(0, 113, 227, 0.3)',
            borderRadius: 12,
            padding: '20px 16px',
            textAlign: 'center',
          }}
        >
          <div style={{ 
            fontSize: 11, 
            color: 'rgba(255, 255, 255, 0.7)', 
            marginBottom: 10, 
            fontWeight: 600,
            letterSpacing: '0.5px',
            textTransform: 'uppercase'
          }}>
            Total Queries
          </div>
          <div style={{ 
            fontSize: 32, 
            fontWeight: 700, 
            color: '#FFFFFF',
            marginBottom: 6,
            lineHeight: 1
          }}>
            {grandTotal.toLocaleString()}
          </div>
          <div style={{ 
            fontSize: 11, 
            color: 'rgba(255, 255, 255, 0.5)',
            fontWeight: 500
          }}>
            Latest: {latestDateFormatted}
          </div>
        </div>
      </div>

      <div
        style={{
          background: 'rgba(255, 255, 255, 0.06)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 12,
          padding: 24,
        }}
      >
        {/* Position Filters with Percentages */}
        <div style={{ marginBottom: 24, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {POSITION_FILTERS.map(filter => {
            const percentage = comparisonPercentages ? (comparisonPercentages as any)[filter.key] : null;
            return (
              <label
                key={filter.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  padding: '8px 12px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  borderRadius: 8,
                  background: activeFilters.has(filter.key) ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.03)',
                  transition: 'all 0.2s',
                  minWidth: percentage !== null ? 140 : 'auto',
                }}
              >
                <input
                  type="checkbox"
                  checked={activeFilters.has(filter.key)}
                  onChange={() => toggleFilter(filter.key)}
                  style={{ cursor: 'pointer' }}
                  aria-label={`Position ${filter.label}`}
                />
                <span
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    background: activeFilters.has(filter.key) ? filter.color : 'rgba(255, 255, 255, 0.2)',
                  }}
                />
                <span style={{ fontSize: 14, fontWeight: 500, color: '#FFFFFF' }}>{filter.label}</span>
                {percentage !== null && (
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: percentage > 0 ? '#51CF66' : percentage < 0 ? '#FF6B6B' : 'rgba(255, 255, 255, 0.5)',
                      marginLeft: 'auto',
                    }}
                  >
                    {formatPercentage(percentage)}
                  </span>
                )}
              </label>
            );
          })}
        </div>

        {/* Date Range and Debug Info */}
        {dateRangeText && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500 }}>
              {dateRangeText}
            </div>
            {debugInfo.datesWithZeroQueries > 0 && (
              <div style={{ fontSize: 12, color: '#FF6B6B', marginTop: 4 }}>
                ⚠️ Warning: {debugInfo.datesWithZeroQueries} days with zero queries detected. 
                This may indicate a data fetching issue or GSC data gap.
              </div>
            )}
            <div style={{ fontSize: 11, color: 'rgba(255, 255, 255, 0.5)', marginTop: 4 }}>
              Total queries: {debugInfo.totalQueries.toLocaleString()} | 
              Data points: {debugInfo.dataPoints} | 
              Days: {debugInfo.uniqueDays}
            </div>
          </div>
        )}

        {/* Chart */}
        {chartData.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255, 255, 255, 0.6)' }}>
            No data available for the selected period
          </div>
        ) : (
          <div style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
            <svg 
              width="100%" 
              height={chartHeight}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              preserveAspectRatio="xMidYMid meet"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <g transform={`translate(${padding.left}, ${padding.top})`}>
                {/* Y-axis grid lines and labels */}
                {yAxisLabels.map((value, i) => (
                  <g key={i}>
                    <line
                      x1={0}
                      y1={yScale(value)}
                      x2={innerWidth}
                      y2={yScale(value)}
                      stroke="rgba(255, 255, 255, 0.08)"
                      strokeWidth={1}
                    />
                    <text
                      x={-10}
                      y={yScale(value)}
                      textAnchor="end"
                      alignmentBaseline="middle"
                      fontSize={12}
                      fill="rgba(255, 255, 255, 0.6)"
                    >
                      {value.toLocaleString()}
                    </text>
                  </g>
                ))}

                {/* Render chart based on view mode */}
                {isStackedView ? (
                  // Stacked Area Chart
                  [...POSITION_FILTERS].reverse().map(filter => {
                    if (!activeFilters.has(filter.key)) return null;
                    return (
                      <path
                        key={filter.key}
                        d={generateAreaPath(filter.key)}
                        fill={filter.color}
                        opacity={0.8}
                        stroke={filter.color}
                        strokeWidth={1}
                      />
                    );
                  })
                ) : (
                  // Line Chart
                  POSITION_FILTERS.map(filter => {
                    if (!activeFilters.has(filter.key)) return null;
                    return (
                      <path
                        key={filter.key}
                        d={generateLinePath(filter.key)}
                        fill="none"
                        stroke={filter.color}
                        strokeWidth={2}
                      />
                    );
                  })
                )}

                {/* X-axis labels */}
                {chartData.map((d, i) => {
                  const showLabel = i % Math.max(Math.floor(chartData.length / 5), 1) === 0 || i === chartData.length - 1;
                  if (!showLabel) return null;
                  
                  return (
                    <text
                      key={i}
                      x={xScale(i)}
                      y={innerHeight + 20}
                      textAnchor="middle"
                      fontSize={12}
                      fill="rgba(255, 255, 255, 0.6)"
                    >
                      {formatDate(d.date)}
                    </text>
                  );
                })}

                {/* Invisible hover areas for tooltip */}
                {chartData.map((d, i) => (
                  <rect
                    key={i}
                    x={xScale(i) - 5}
                    y={0}
                    width={10}
                    height={innerHeight}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredIndex(i)}
                  />
                ))}

                {/* Hover line and points */}
                {hoveredIndex !== null && (
                  <>
                    <line
                      x1={xScale(hoveredIndex)}
                      y1={0}
                      x2={xScale(hoveredIndex)}
                      y2={innerHeight}
                      stroke="rgba(255, 255, 255, 0.4)"
                      strokeWidth={1}
                      strokeDasharray="4,4"
                    />
                    {POSITION_FILTERS.filter(f => activeFilters.has(f.key)).map(filter => {
                      const value = isStackedView 
                        ? chartData[hoveredIndex][`${filter.key}_end`] 
                        : chartData[hoveredIndex][filter.key];
                      return (
                        <circle
                          key={filter.key}
                          cx={xScale(hoveredIndex)}
                          cy={yScale(value || 0)}
                          r={4}
                          fill={filter.color}
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      );
                    })}
                  </>
                )}
              </g>
            </svg>

            {/* Tooltip */}
            {hoveredIndex !== null && (
              <div
                style={{
                  position: 'absolute',
                  left: Math.min(padding.left + xScale(hoveredIndex) + 10, chartWidth - 200),
                  top: padding.top + 10,
                  background: 'rgba(0, 0, 0, 0.9)',
                  color: '#fff',
                  padding: 12,
                  borderRadius: 8,
                  fontSize: 12,
                  pointerEvents: 'none',
                  zIndex: 10,
                  minWidth: 180,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 8 }}>
                  {formatDateLong(chartData[hoveredIndex].date)}
                </div>
                {POSITION_FILTERS.filter(f => activeFilters.has(f.key)).map(filter => (
                  <div key={filter.key} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span>Position {filter.label}:</span>
                    <span style={{ fontWeight: 600, marginLeft: 12 }}>
                      {(chartData[hoveredIndex][filter.key] || 0).toLocaleString()} queries
                    </span>
                  </div>
                ))}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Total:</span>
                  <span style={{ fontWeight: 600, marginLeft: 12 }}>
                    {(chartData[hoveredIndex].max || 0).toLocaleString()} queries
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
          {POSITION_FILTERS.filter(f => activeFilters.has(f.key)).map(filter => (
            <div key={filter.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  background: filter.color,
                }}
              />
              <span style={{ fontSize: 14, color: 'rgba(255, 255, 255, 0.8)', fontWeight: 500 }}>Position {filter.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
