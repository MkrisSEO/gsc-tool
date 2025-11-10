'use client';

import { useState, useRef, useEffect } from 'react';

type PeriodType = 'day' | 'week' | 'month';
type DatePreset = 
  | 'today' | 'yesterday' | 'specificDate'
  | '7days' | '14days' | '28days'
  | 'lastWeek' | 'thisMonth' | 'lastMonth'
  | 'thisQuarter' | 'lastQuarter'
  | 'yearToDate'
  | '3months' | '6months' | '8months' | '12months' | '16months' | '2years' | '3years'
  | 'custom';

type ComparisonType = 'disabled' | 'previousPeriod' | 'yearOverYear' | 'previousMonth' | 'previousWeek' | 'custom';

interface AdvancedDateRangeSelectorProps {
  dateRange: { startDate: string; endDate: string };
  compareRange: { startDate: string; endDate: string } | null;
  onDateChange: (startDate: string, endDate: string) => void;
  onCompareChange: (compareRange: { startDate: string; endDate: string } | null) => void;
}

export default function AdvancedDateRangeSelector({
  dateRange,
  compareRange,
  onDateChange,
  onCompareChange,
}: AdvancedDateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [periodType, setPeriodType] = useState<PeriodType>('day');
  const [selectedPreset, setSelectedPreset] = useState<DatePreset>('28days');
  const [comparisonType, setComparisonType] = useState<ComparisonType>('disabled');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [customCompareStartDate, setCustomCompareStartDate] = useState('');
  const [customCompareEndDate, setCustomCompareEndDate] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize with default
  useEffect(() => {
    applyPreset('28days');
  }, []);

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  const getQuarterStart = (date: Date): Date => {
    const quarter = Math.floor(date.getMonth() / 3);
    return new Date(date.getFullYear(), quarter * 3, 1);
  };

  const getQuarterEnd = (date: Date): Date => {
    const quarter = Math.floor(date.getMonth() / 3);
    return new Date(date.getFullYear(), quarter * 3 + 3, 0);
  };

  const applyPreset = (preset: DatePreset) => {
    const today = new Date();
    // ✅ Adjust for GSC data lag (2 days)
    today.setDate(today.getDate() - 2);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let startDate = new Date();
    let endDate = new Date(today);

    switch (preset) {
      case 'today':
        startDate = today;
        endDate = today;
        break;
      case 'yesterday':
        startDate = yesterday;
        endDate = yesterday;
        break;
      case '7days':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '14days':
        startDate.setDate(endDate.getDate() - 14);
        break;
      case '28days':
        startDate.setDate(endDate.getDate() - 28);
        break;
      case 'lastWeek': {
        const day = today.getDay();
        const diff = day === 0 ? 6 : day - 1; // Monday = 0
        const lastMonday = new Date(today);
        lastMonday.setDate(today.getDate() - diff - 7);
        const lastSunday = new Date(lastMonday);
        lastSunday.setDate(lastMonday.getDate() + 6);
        startDate = lastMonday;
        endDate = lastSunday;
        break;
      }
      case 'thisMonth':
        startDate = new Date(today.getFullYear(), today.getMonth(), 1);
        endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      case 'lastMonth':
        startDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        endDate = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      case 'thisQuarter':
        startDate = getQuarterStart(today);
        endDate = getQuarterEnd(today);
        break;
      case 'lastQuarter': {
        const lastQuarterDate = new Date(today);
        lastQuarterDate.setMonth(today.getMonth() - 3);
        startDate = getQuarterStart(lastQuarterDate);
        endDate = getQuarterEnd(lastQuarterDate);
        break;
      }
      case 'yearToDate':
        startDate = new Date(today.getFullYear(), 0, 1);
        endDate = today;
        break;
      case '3months':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case '6months':
        startDate.setMonth(endDate.getMonth() - 6);
        break;
      case '8months':
        startDate.setMonth(endDate.getMonth() - 8);
        break;
      case '12months':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      case '16months':
        startDate.setMonth(endDate.getMonth() - 16);
        break;
      case '2years':
        startDate.setFullYear(endDate.getFullYear() - 2);
        break;
      case '3years':
        startDate.setFullYear(endDate.getFullYear() - 3);
        break;
      case 'custom':
        return; // Don't auto-apply for custom
    }

    setSelectedPreset(preset);
    onDateChange(formatDate(startDate), formatDate(endDate));
    
    // Apply comparison if enabled
    if (comparisonType !== 'disabled') {
      applyComparison(comparisonType, startDate, endDate);
    }
  };

  const applyComparison = (type: ComparisonType, start: Date, end: Date) => {
    if (type === 'disabled') {
      onCompareChange(null);
      return;
    }

    const daysDiff = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    let compareStart = new Date(start);
    let compareEnd = new Date(end);

    switch (type) {
      case 'previousPeriod':
        compareEnd = new Date(start);
        compareEnd.setDate(compareEnd.getDate() - 1);
        compareStart = new Date(compareEnd);
        compareStart.setDate(compareStart.getDate() - daysDiff);
        break;
      case 'yearOverYear':
        compareStart = new Date(start);
        compareStart.setFullYear(compareStart.getFullYear() - 1);
        compareEnd = new Date(end);
        compareEnd.setFullYear(compareEnd.getFullYear() - 1);
        break;
      case 'previousMonth': {
        const prevMonth = new Date(start);
        prevMonth.setMonth(prevMonth.getMonth() - 1);
        compareStart = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1);
        compareEnd = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0);
        break;
      }
      case 'previousWeek': {
        compareEnd = new Date(start);
        compareEnd.setDate(compareEnd.getDate() - 1);
        compareStart = new Date(compareEnd);
        compareStart.setDate(compareStart.getDate() - 6);
        break;
      }
      case 'custom':
        return; // Don't auto-apply for custom
    }

    onCompareChange({
      startDate: formatDate(compareStart),
      endDate: formatDate(compareEnd),
    });
  };

  const handlePresetClick = (preset: DatePreset) => {
    setPeriodType(preset === 'today' || preset === 'yesterday' ? 'day' : 
                  preset === 'lastWeek' ? 'week' : 
                  preset === 'thisMonth' || preset === 'lastMonth' ? 'month' : 'day');
    applyPreset(preset);
  };

  const handleComparisonChange = (type: ComparisonType) => {
    setComparisonType(type);
    if (type === 'disabled') {
      onCompareChange(null);
    } else if (type !== 'custom') {
      const start = new Date(dateRange.startDate);
      const end = new Date(dateRange.endDate);
      applyComparison(type, start, end);
    }
  };

  const handleCustomDateApply = () => {
    if (customStartDate && customEndDate) {
      onDateChange(customStartDate, customEndDate);
      setSelectedPreset('custom');
    }
  };

  const handleCustomCompareApply = () => {
    if (customCompareStartDate && customCompareEndDate) {
      onCompareChange({
        startDate: customCompareStartDate,
        endDate: customCompareEndDate,
      });
      setComparisonType('custom');
    }
  };

  const formatDisplayDate = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
    
    if (start === end) {
      return startDate.toLocaleDateString('en-US', { ...options, year: 'numeric' });
    }
    
    return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', { ...options, year: 'numeric' })}`;
  };

  const getPresetLabel = (preset: DatePreset): string => {
    const labels: Record<DatePreset, string> = {
      today: 'Today',
      yesterday: 'Yesterday',
      specificDate: 'Specific Date',
      '7days': '7 days',
      '14days': '14 days',
      '28days': '28 days',
      lastWeek: 'Last Week',
      thisMonth: 'This Month',
      lastMonth: 'Last Month',
      thisQuarter: 'This Quarter',
      lastQuarter: 'Last Quarter',
      yearToDate: 'Year to Date',
      '3months': '3 months',
      '6months': '6 months',
      '8months': '8 months',
      '12months': '12 months',
      '16months': '16 months',
      '2years': '2 years',
      '3years': '3 years',
      custom: 'Custom',
    };
    return labels[preset] || preset;
  };

  const dayPresets: DatePreset[] = ['today', 'yesterday', '7days', '14days', '28days'];
  const weekPresets: DatePreset[] = ['lastWeek', '28days'];
  const monthPresets: DatePreset[] = ['thisMonth', 'lastMonth', 'thisQuarter', 'lastQuarter', 'yearToDate', '3months', '6months', '8months', '12months', '16months', '2years', '3years'];

  const getCurrentPresets = () => {
    switch (periodType) {
      case 'day': return dayPresets;
      case 'week': return weekPresets;
      case 'month': return monthPresets;
      default: return dayPresets;
    }
  };

  return (
    <div>
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="btn-secondary"
          style={{
            minWidth: 220,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span>
            {dateRange.startDate && dateRange.endDate 
              ? formatDisplayDate(dateRange.startDate, dateRange.endDate)
              : 'Select date range'}
          </span>
          <span style={{ fontSize: 12, opacity: 0.7 }}>▼</span>
        </button>

        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 8,
              background: 'rgba(0, 18, 31, 0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 16,
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
              zIndex: 1000,
              minWidth: 540,
              padding: 0,
            }}
          >
            {/* Period Type Tabs */}
            <div style={{ 
              display: 'flex', 
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              background: 'rgba(255, 255, 255, 0.03)'
            }}>
              {(['day', 'week', 'month'] as PeriodType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setPeriodType(type)}
                  style={{
                    flex: 1,
                    padding: '14px 16px',
                    border: 'none',
                    background: periodType === type ? 'rgba(0, 113, 227, 0.15)' : 'transparent',
                    borderBottom: periodType === type ? '2px solid #0071E3' : '2px solid transparent',
                    cursor: 'pointer',
                    fontSize: 14,
                    fontWeight: periodType === type ? 700 : 500,
                    color: periodType === type ? '#0071E3' : 'rgba(255, 255, 255, 0.6)',
                    textTransform: 'capitalize',
                    transition: 'all 0.2s',
                  }}
                >
                  {type}
                </button>
              ))}
            </div>

            <div style={{ padding: 20 }}>
              {/* Time Period Section */}
              <div style={{ marginBottom: 20 }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Time Period
                </h4>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: 8 
                }}>
                  {getCurrentPresets().map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handlePresetClick(preset)}
                      style={{
                        padding: '10px 14px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: 8,
                        background: selectedPreset === preset ? 'rgba(0, 113, 227, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: selectedPreset === preset ? 700 : 500,
                        color: selectedPreset === preset ? '#0071E3' : 'rgba(255, 255, 255, 0.9)',
                        borderColor: selectedPreset === preset ? '#0071E3' : 'rgba(255, 255, 255, 0.15)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {getPresetLabel(preset)}
                    </button>
                  ))}
                  <button
                    onClick={() => setSelectedPreset('custom')}
                    style={{
                      padding: '10px 14px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: 8,
                      background: selectedPreset === 'custom' ? 'rgba(0, 113, 227, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: selectedPreset === 'custom' ? 700 : 500,
                      color: selectedPreset === 'custom' ? '#0071E3' : 'rgba(255, 255, 255, 0.9)',
                      borderColor: selectedPreset === 'custom' ? '#0071E3' : 'rgba(255, 255, 255, 0.15)',
                      transition: 'all 0.2s',
                    }}
                  >
                    Custom
                  </button>
                </div>

                {selectedPreset === 'custom' && (
                  <div style={{ marginTop: 12, padding: 14, background: 'rgba(255, 255, 255, 0.05)', borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: 8,
                          fontSize: 13,
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#FFFFFF',
                        }}
                      />
                      <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>to</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: 8,
                          fontSize: 13,
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#FFFFFF',
                        }}
                      />
                    </div>
                    <button
                      onClick={handleCustomDateApply}
                      className="btn-primary"
                      style={{
                        width: '100%',
                        fontSize: 13,
                      }}
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>

              {/* Comparison Period Section */}
              <div style={{ 
                borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                paddingTop: 20,
              }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 12, fontWeight: 700, color: 'rgba(255, 255, 255, 0.7)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Comparison Period
                </h4>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(3, 1fr)', 
                  gap: 8,
                  marginBottom: 8
                }}>
                  {(['disabled', 'previousPeriod', 'yearOverYear', 'previousMonth', 'previousWeek', 'custom'] as ComparisonType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => handleComparisonChange(type)}
                      style={{
                        padding: '10px 14px',
                        border: '1px solid rgba(255, 255, 255, 0.15)',
                        borderRadius: 8,
                        background: comparisonType === type ? 'rgba(0, 113, 227, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: comparisonType === type ? 700 : 500,
                        color: comparisonType === type ? '#0071E3' : 'rgba(255, 255, 255, 0.9)',
                        borderColor: comparisonType === type ? '#0071E3' : 'rgba(255, 255, 255, 0.15)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {type === 'disabled' ? 'Disabled' :
                       type === 'previousPeriod' ? 'Previous Period' :
                       type === 'yearOverYear' ? 'Year Over Year' :
                       type === 'previousMonth' ? 'Previous Month' :
                       type === 'previousWeek' ? 'Previous Week' : 'Custom'}
                    </button>
                  ))}
                </div>

                {comparisonType === 'custom' && (
                  <div style={{ padding: 14, background: 'rgba(255, 255, 255, 0.05)', borderRadius: 10, border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
                      <input
                        type="date"
                        value={customCompareStartDate}
                        onChange={(e) => setCustomCompareStartDate(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: 8,
                          fontSize: 13,
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#FFFFFF',
                        }}
                      />
                      <span style={{ color: 'rgba(255, 255, 255, 0.6)' }}>to</span>
                      <input
                        type="date"
                        value={customCompareEndDate}
                        onChange={(e) => setCustomCompareEndDate(e.target.value)}
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid rgba(255, 255, 255, 0.2)',
                          borderRadius: 8,
                          fontSize: 13,
                          background: 'rgba(255, 255, 255, 0.08)',
                          color: '#FFFFFF',
                        }}
                      />
                    </div>
                    <button
                      onClick={handleCustomCompareApply}
                      className="btn-primary"
                      style={{
                        width: '100%',
                        fontSize: 13,
                      }}
                    >
                      Apply Comparison
                    </button>
                  </div>
                )}

                {compareRange && comparisonType !== 'disabled' && (
                  <div style={{ 
                    marginTop: 10, 
                    padding: 12, 
                    background: 'rgba(81, 207, 102, 0.15)', 
                    borderRadius: 8,
                    fontSize: 12,
                    color: '#51CF66',
                    border: '1px solid rgba(81, 207, 102, 0.3)',
                  }}>
                    <strong>Comparing with:</strong> {formatDisplayDate(compareRange.startDate, compareRange.endDate)}
                  </div>
                )}
              </div>

              {/* Apply Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="btn-primary"
                style={{
                  width: '100%',
                  marginTop: 20,
                }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}





