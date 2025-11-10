'use client';

import { CSSProperties, ReactNode } from 'react';

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: any) => ReactNode;
  width?: string;
}

interface ModernTableProps {
  columns: Column[];
  data: any[];
  onRowClick?: (row: any) => void;
  emptyMessage?: string;
}

export default function ModernTable({
  columns,
  data,
  onRowClick,
  emptyMessage = 'No data available',
}: ModernTableProps) {
  if (data.length === 0) {
    return (
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 16,
          padding: 48,
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📊</div>
        <p style={{ margin: 0, fontSize: 16, color: 'rgba(255, 255, 255, 0.7)' }}>
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
      }}
    >
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'rgba(0, 113, 227, 0.08)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{
                    padding: '16px 20px',
                    textAlign: column.align || 'left',
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'rgba(255, 255, 255, 0.9)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.8px',
                    width: column.width,
                  }}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                onClick={() => onRowClick?.(row)}
                style={{
                  borderBottom: rowIndex < data.length - 1 ? '1px solid rgba(255, 255, 255, 0.06)' : 'none',
                  cursor: onRowClick ? 'pointer' : 'default',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 113, 227, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={{
                      padding: '16px 20px',
                      textAlign: column.align || 'left',
                      fontSize: 14,
                      color: 'rgba(255, 255, 255, 0.9)',
                      fontWeight: 500,
                    }}
                  >
                    {column.render ? column.render(row[column.key], row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


