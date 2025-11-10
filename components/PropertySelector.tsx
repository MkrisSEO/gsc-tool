'use client';

import { useState, useEffect } from 'react';

interface Site {
  siteUrl: string;
  permissionLevel: string;
}

interface PropertySelectorProps {
  onSelect: (siteUrl: string) => void;
  selectedSite?: string;
}

export default function PropertySelector({ onSelect, selectedSite }: PropertySelectorProps) {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/search-console/sites')
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setSites(data.sites || []);
          if (data.sites && data.sites.length > 0 && !selectedSite) {
            onSelect(data.sites[0].siteUrl);
          }
        }
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div style={{ padding: 16 }}>Loading properties...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 16, color: '#d00', background: '#ffeef0', borderRadius: 8 }}>
        Error loading properties: {error}
      </div>
    );
  }

  if (sites.length === 0) {
    return (
      <div style={{ padding: 16, background: '#fff3cd', borderRadius: 8 }}>
        No Search Console properties found. Make sure you have verified properties in Google Search Console.
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 24 }}>
      <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>
        Select Property:
      </label>
      <select
        value={selectedSite || ''}
        onChange={(e) => onSelect(e.target.value)}
        style={{
          padding: '8px 12px',
          borderRadius: 8,
          border: '1px solid #ccc',
          fontSize: 14,
          minWidth: 300,
        }}
      >
        {sites.map((site) => (
          <option key={site.siteUrl} value={site.siteUrl}>
            {site.siteUrl}
          </option>
        ))}
      </select>
    </div>
  );
}

