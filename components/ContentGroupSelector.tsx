'use client';

import { useEffect, useState } from 'react';

interface ContentGroup {
  id: string;
  name: string;
  urlCount: number;
}

interface ContentGroupSelectorProps {
  siteUrl: string;
  selectedGroupId: string | null;
  onGroupChange: (groupId: string | null) => void;
}

export default function ContentGroupSelector({
  siteUrl,
  selectedGroupId,
  onGroupChange,
}: ContentGroupSelectorProps) {
  const [groups, setGroups] = useState<ContentGroup[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (siteUrl) {
      fetchGroups();
    }
  }, [siteUrl]);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/content-groups?siteUrl=${encodeURIComponent(siteUrl)}`);
      const json = await response.json();
      
      if (response.ok && json.groups) {
        setGroups(json.groups);
      }
    } catch (err) {
      console.error('Failed to fetch content groups:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || groups.length === 0) return null;

  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
        Content Group Filter
      </label>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <select
          value={selectedGroupId || ''}
          onChange={(e) => onGroupChange(e.target.value || null)}
          style={{
            padding: '10px 14px',
            border: '1px solid #cbd5e1',
            borderRadius: 8,
            fontSize: 14,
            minWidth: 250,
            background: '#fff',
          }}
        >
          <option value="">All Pages</option>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name} ({group.urlCount} URLs)
            </option>
          ))}
        </select>

        {selectedGroup && (
          <span style={{ fontSize: 13, color: '#64748b' }}>
            Showing data for {selectedGroup.urlCount} URLs in "{selectedGroup.name}"
          </span>
        )}
      </div>
    </div>
  );
}

