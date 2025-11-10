'use client';

interface CacheStatusBadgeProps {
  cached: boolean;
  label?: string;
}

export default function CacheStatusBadge({ cached, label = 'Data' }: CacheStatusBadgeProps) {
  if (!cached) return null; // Only show when cached
  
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 6,
        backgroundColor: '#10b981',
        color: 'white',
        fontSize: 12,
        fontWeight: 600,
        boxShadow: '0 1px 3px rgba(16, 185, 129, 0.3)',
      }}
    >
      <span style={{ fontSize: 14 }}>⚡</span>
      <span>{label} loaded from cache</span>
    </div>
  );
}

