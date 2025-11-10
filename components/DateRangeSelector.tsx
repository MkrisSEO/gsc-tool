'use client';

import { useState, useRef, useEffect } from 'react';

type DatePreset = 'last28' | 'last90' | 'compare28' | 'compareYear' | 'custom';

interface DateRangeSelectorProps {
  dateRange: { startDate: string; endDate: string };
  compareRange: { startDate: string; endDate: string } | null;
  datePreset: DatePreset;
  onPresetChange: (preset: DatePreset) => void;
  onDateChange: (startDate: string, endDate: string) => void;
  onCompareChange: (enabled: boolean, type: 'previous' | 'year' | 'custom') => void;
}

export default function DateRangeSelector({
  dateRange,
  compareRange,
  datePreset,
  onPresetChange,
  onDateChange,
  onCompareChange,
}: DateRangeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const compareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (compareRef.current && !compareRef.current.contains(event.target as Node)) {
        setCompareOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatDateRange = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const days = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    return `${days} days`;
  };

  const presets = [
    { key: 'last28' as DatePreset, label: '28 days' },
    { key: 'last90' as DatePreset, label: '90 days' },
    { key: 'custom' as DatePreset, label: 'Custom' },
  ];

  const compareOptions = [
    { key: 'disabled', label: 'Disabled' },
    { key: 'previous', label: 'Previous Period' },
    { key: 'year', label: 'Year Over Year' },
  ];

  const getCurrentPresetLabel = () => {
    if (datePreset === 'custom') {
      return formatDateRange(dateRange.startDate, dateRange.endDate);
    }
    return presets.find((p) => p.key === datePreset)?.label || 'Select period';
  };

  const getCompareLabel = () => {
    if (!compareRange) return 'Disabled';
    if (datePreset === 'compare28') return 'Previous Period';
    if (datePreset === 'compareYear') return 'Year Over Year';
    return 'Custom';
  };

  return (
    <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
      {/* Primary Date Range */}
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            padding: '8px 16px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            background: '#fff',
            cursor: 'pointer',
            fontSize: 14,
            minWidth: 150,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>{getCurrentPresetLabel()}</span>
          <span style={{ fontSize: 12 }}>▼</span>
        </button>
        {isOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              background: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              zIndex: 1000,
              minWidth: 200,
              padding: 8,
            }}
          >
            {presets.map((preset) => (
              <div
                key={preset.key}
                onClick={() => {
                  onPresetChange(preset.key);
                  setIsOpen(false);
                }}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderRadius: 4,
                  background: datePreset === preset.key ? '#eff6ff' : 'transparent',
                  fontWeight: datePreset === preset.key ? 600 : 400,
                  fontSize: 14,
                }}
              >
                {preset.label}
              </div>
            ))}
            {datePreset === 'custom' && (
              <div style={{ marginTop: 8, padding: '8px 12px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => onDateChange(e.target.value, dateRange.endDate)}
                    style={{
                      padding: '4px 8px',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => onDateChange(dateRange.startDate, e.target.value)}
                    style={{
                      padding: '4px 8px',
                      border: '1px solid #d1d5db',
                      borderRadius: 4,
                      fontSize: 12,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Comparison Period */}
      <div ref={compareRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setCompareOpen(!compareOpen)}
          style={{
            padding: '8px 16px',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            background: compareRange ? '#eff6ff' : '#fff',
            cursor: 'pointer',
            fontSize: 14,
            minWidth: 150,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>{getCompareLabel()}</span>
          <span style={{ fontSize: 12 }}>▼</span>
        </button>
        {compareOpen && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              background: '#fff',
              border: '1px solid #d1d5db',
              borderRadius: 8,
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
              zIndex: 1000,
              minWidth: 200,
              padding: 8,
            }}
          >
            {compareOptions.map((option) => (
              <div
                key={option.key}
                onClick={() => {
                  if (option.key === 'disabled') {
                    onCompareChange(false, 'previous');
                  } else if (option.key === 'previous') {
                    onCompareChange(true, 'previous');
                    onPresetChange('compare28');
                  } else if (option.key === 'year') {
                    onCompareChange(true, 'year');
                    onPresetChange('compareYear');
                  }
                  setCompareOpen(false);
                }}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderRadius: 4,
                  background:
                    (option.key === 'disabled' && !compareRange) ||
                    (option.key === 'previous' && datePreset === 'compare28') ||
                    (option.key === 'year' && datePreset === 'compareYear')
                      ? '#eff6ff'
                      : 'transparent',
                  fontWeight:
                    (option.key === 'disabled' && !compareRange) ||
                    (option.key === 'previous' && datePreset === 'compare28') ||
                    (option.key === 'year' && datePreset === 'compareYear')
                      ? 600
                      : 400,
                  fontSize: 14,
                }}
              >
                {option.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}







