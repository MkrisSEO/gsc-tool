'use client';

import { useState, useRef, useEffect } from 'react';

interface MetricSelectorProps {
  selectedMetrics: string[];
  onMetricsChange: (metrics: string[]) => void;
}

const availableMetrics = [
  { key: 'clicks', label: 'Clicks', color: '#2563eb' },
  { key: 'impressions', label: 'Impressions', color: '#7c3aed' },
  { key: 'ctr', label: 'CTR', color: '#059669' },
  { key: 'position', label: 'Position', color: '#ea580c' },
];

export default function MetricSelector({ selectedMetrics, onMetricsChange }: MetricSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
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

  const toggleMetric = (metricKey: string) => {
    if (selectedMetrics.includes(metricKey)) {
      if (selectedMetrics.length > 1) {
        onMetricsChange(selectedMetrics.filter((m) => m !== metricKey));
      }
    } else {
      onMetricsChange([...selectedMetrics, metricKey]);
    }
  };

  const getLabel = () => {
    if (selectedMetrics.length === 0) return 'Select metrics';
    if (selectedMetrics.length === availableMetrics.length) return 'All metrics';
    if (selectedMetrics.length === 1) {
      return availableMetrics.find((m) => m.key === selectedMetrics[0])?.label || '1 metric';
    }
    return `${selectedMetrics.length} metrics`;
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          padding: '8px 16px',
          border: '1px solid #d1d5db',
          borderRadius: 8,
          background: '#fff',
          cursor: 'pointer',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 150,
        }}
      >
        <span>📊</span>
        <span>{getLabel()}</span>
        <span style={{ fontSize: 12, marginLeft: 'auto' }}>▼</span>
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
          {availableMetrics.map((metric) => {
            const isSelected = selectedMetrics.includes(metric.key);
            return (
              <div
                key={metric.key}
                onClick={() => toggleMetric(metric.key)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  borderRadius: 4,
                  background: isSelected ? '#eff6ff' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 14,
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  style={{ cursor: 'pointer' }}
                />
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    background: metric.color,
                  }}
                />
                <span style={{ fontWeight: isSelected ? 600 : 400 }}>{metric.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

