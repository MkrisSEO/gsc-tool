'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import UrlChipsInput from '@/components/UrlChipsInput';
import type { ContentGroup, Condition, ConditionOperator, ConditionType } from '@/lib/contentGroupsStorage';

const OPERATOR_LABELS: Record<string, string> = {
  contains: 'Contains',
  equals: 'Equals',
  regex: 'Matches Regex',
  batch: 'Matches Any (Batch)',
  'not-contains': "Doesn't Contain",
  'not-equals': "Doesn't Equal",
  'not-regex': "Doesn't Match Regex",
  'not-batch': "Doesn't Match Any (Batch)",
};

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedSite, setSelectedSite] = useState('');
  const [groups, setGroups] = useState<ContentGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [conditions, setConditions] = useState<Condition[]>([
    { type: 'inclusion', operator: 'contains', value: '' },
  ]);
  const [preview, setPreview] = useState<{ count: number; sampleUrls: string[]; totalUrls: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    } else if (status === 'authenticated') {
      const site = searchParams.get('site');
      if (!site) {
        router.push('/properties');
      } else {
        setSelectedSite(site);
      }
    }
  }, [status, router, searchParams]);

  useEffect(() => {
    if (selectedSite) {
      fetchContentGroups();
    }
  }, [selectedSite]);

  const fetchContentGroups = async () => {
    if (!selectedSite) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/content-groups?siteUrl=${encodeURIComponent(selectedSite)}`);
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

  const fetchPreview = async () => {
    if (!selectedSite || conditions.length === 0) return;

    setPreviewLoading(true);
    try {
      const response = await fetch('/api/content-groups/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          siteUrl: selectedSite,
          conditions,
        }),
      });

      const json = await response.json();
      
      if (response.ok) {
        setPreview(json);
      }
    } catch (err) {
      console.error('Failed to fetch preview:', err);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleAddCondition = () => {
    setConditions([...conditions, { type: 'inclusion', operator: 'contains', value: '' }]);
  };

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const handleConditionChange = (index: number, field: keyof Condition, value: any) => {
    const updated = [...conditions];
    updated[index] = { ...updated[index], [field]: value };
    setConditions(updated);
  };

  const handleSaveGroup = async () => {
    if (!groupName.trim()) {
      alert('Please enter a group name');
      return;
    }

    if (conditions.length === 0 || conditions.every((c) => !c.value)) {
      alert('Please add at least one condition');
      return;
    }

    setSaving(true);
    try {
      const method = editingGroupId ? 'PUT' : 'POST';
      const url = editingGroupId 
        ? `/api/content-groups?id=${editingGroupId}`
        : '/api/content-groups';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupName,
          siteUrl: selectedSite,
          conditions,
        }),
      });

      const json = await response.json();
      
      if (response.ok && json.group) {
        setShowForm(false);
        setEditingGroupId(null);
        setGroupName('');
        setConditions([{ type: 'inclusion', operator: 'contains', value: '' }]);
        setPreview(null);
        fetchContentGroups();
        alert(`✅ Content group ${editingGroupId ? 'updated' : 'created'} successfully! Found ${json.group.urlCount} matching URLs.`);
      } else {
        throw new Error(json.error || 'Failed to save content group');
      }
    } catch (err) {
      console.error('Failed to save content group:', err);
      alert('❌ Failed to save: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (group: ContentGroup) => {
    setEditingGroupId(group.id);
    setGroupName(group.name);
    setConditions(group.conditions);
    setShowForm(true);
    setPreview({ count: group.urlCount, sampleUrls: group.matchedUrls.slice(0, 10), totalUrls: group.urlCount });
  };

  const handleRefresh = async (group: ContentGroup) => {
    if (!confirm(`Refresh matched URLs for "${group.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/content-groups?id=${group.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: group.name,
          siteUrl: group.siteUrl,
          conditions: group.conditions,
        }),
      });

      const json = await response.json();

      if (response.ok && json.group) {
        fetchContentGroups();
        alert(`✅ Refreshed! Now matching ${json.group.urlCount} URLs.`);
      } else {
        throw new Error(json.error || 'Failed to refresh content group');
      }
    } catch (err) {
      console.error('Failed to refresh content group:', err);
      alert('❌ Failed to refresh: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this content group?')) {
      return;
    }

    try {
      const response = await fetch(`/api/content-groups?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchContentGroups();
        alert('✅ Content group deleted');
      } else {
        const json = await response.json();
        throw new Error(json.error || 'Failed to delete content group');
      }
    } catch (err) {
      console.error('Failed to delete content group:', err);
      alert('❌ Failed to delete: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const formatConditionSummary = (group: ContentGroup): string => {
    const summaries = group.conditions.map((c) => {
      const prefix = c.type === 'inclusion' ? '' : 'NOT ';
      const op = c.operator === 'contains' ? 'contains' : 
                 c.operator === 'equals' ? 'equals' :
                 c.operator === 'regex' ? 'matches' : 'in list';
      const val = Array.isArray(c.value) ? `${c.value.length} URLs` : c.value;
      return `${prefix}${op}: ${val}`;
    });
    return summaries.join(', ');
  };

  if (status === 'loading') {
    return (
      <main style={{ padding: 24 }}>
        <div>Loading...</div>
      </main>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <main style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <button
              onClick={() => router.push('/properties')}
              style={{
                padding: '6px 12px',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              ← Back to Properties
            </button>
          </div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Settings - Content Groups</h1>
          <p style={{ margin: '8px 0 0', color: '#6b7280' }}>{selectedSite}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 14, color: '#6b7280' }}>{session.user?.email}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            style={{
              padding: '8px 16px',
              background: '#dc2626',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Sign Out
          </button>
        </div>
      </div>

      {/* Description */}
      <div style={{ padding: 20, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, marginBottom: 24 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 600, color: '#1e40af' }}>
          About Content Groups
        </h3>
        <p style={{ margin: 0, fontSize: 14, color: '#1e3a8a', lineHeight: 1.6 }}>
          Grouping related pages allows you to analyze the performance of multiple pages much more efficiently. 
          Common use cases include a group for all blog posts, pages related to a similar topic, multiple landing pages, or pSEO pages.
        </p>
      </div>

      {error && (
        <div style={{ padding: 16, background: '#fee2e2', color: '#b91c1c', borderRadius: 8, marginBottom: 24 }}>
          {error}
        </div>
      )}

      {!showForm && (
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => {
              setShowForm(true);
              setEditingGroupId(null);
              setGroupName('');
              setConditions([{ type: 'inclusion', operator: 'contains', value: '' }]);
              setPreview(null);
            }}
            style={{
              padding: '10px 20px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>+</span>
            Create Content Group
          </button>
        </div>
      )}

      {showForm && (
        <div style={{ padding: 24, background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 600 }}>
            {editingGroupId ? 'Edit Content Group' : 'Create Content Group'}
          </h3>

          {/* Group Name */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
              Group Name <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g., Blog Posts"
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                fontSize: 14,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Conditions */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 12, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
              Conditions
            </label>
            {conditions.map((condition, index) => (
              <div key={index} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                <select
                  value={`${condition.type}-${condition.operator}`}
                  onChange={(e) => {
                    const [type, operator] = e.target.value.split('-') as [ConditionType, ConditionOperator];
                    handleConditionChange(index, 'type', type);
                    handleConditionChange(index, 'operator', operator);
                  }}
                  style={{
                    padding: '10px 14px',
                    border: '1px solid #cbd5e1',
                    borderRadius: 8,
                    fontSize: 14,
                    minWidth: 200,
                  }}
                >
                  <optgroup label="Inclusion">
                    <option value="inclusion-contains">Contains</option>
                    <option value="inclusion-equals">Equals</option>
                    <option value="inclusion-regex">Matches Regex</option>
                    <option value="inclusion-batch">Matches Any (Batch)</option>
                  </optgroup>
                  <optgroup label="Exclusion">
                    <option value="exclusion-contains">Doesn't Contain</option>
                    <option value="exclusion-equals">Doesn't Equal</option>
                    <option value="exclusion-regex">Doesn't Match Regex</option>
                    <option value="exclusion-batch">Doesn't Match Any (Batch)</option>
                  </optgroup>
                </select>

                {condition.operator === 'batch' ? (
                  <div style={{ flex: 1 }}>
                    <UrlChipsInput
                      urls={Array.isArray(condition.value) ? condition.value : []}
                      onChange={(urls) => handleConditionChange(index, 'value', urls)}
                      placeholder="Paste URLs here (comma or newline separated)"
                    />
                  </div>
                ) : (
                  <input
                    type="text"
                    value={condition.value as string}
                    onChange={(e) => handleConditionChange(index, 'value', e.target.value)}
                    placeholder={
                      condition.operator === 'regex' ? 'e.g., /blog/.*' :
                      condition.operator === 'equals' ? 'e.g., https://example.com/page' :
                      'e.g., /blog/'
                    }
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      fontSize: 14,
                      boxSizing: 'border-box',
                    }}
                  />
                )}

                <button
                  onClick={() => handleRemoveCondition(index)}
                  disabled={conditions.length === 1}
                  style={{
                    padding: '10px 14px',
                    border: '1px solid #fecaca',
                    borderRadius: 8,
                    background: '#fff',
                    color: '#dc2626',
                    fontSize: 14,
                    cursor: conditions.length === 1 ? 'not-allowed' : 'pointer',
                    opacity: conditions.length === 1 ? 0.5 : 1,
                  }}
                >
                  Remove
                </button>
              </div>
            ))}

            <button
              onClick={handleAddCondition}
              style={{
                padding: '8px 16px',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                background: '#fff',
                color: '#475569',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              + Add Condition
            </button>
          </div>

          {/* Preview Button */}
          <div style={{ marginBottom: 20 }}>
            <button
              onClick={fetchPreview}
              disabled={previewLoading}
              style={{
                padding: '10px 20px',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                background: '#f8fafc',
                color: '#0f172a',
                fontSize: 14,
                fontWeight: 600,
                cursor: previewLoading ? 'wait' : 'pointer',
              }}
            >
              {previewLoading ? 'Loading Preview...' : 'Preview Matching URLs'}
            </button>
          </div>

          {/* Preview Section */}
          {preview && (
            <div style={{ padding: 16, background: '#f8fafc', borderRadius: 8, marginBottom: 20 }}>
              <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>
                Preview: {preview.count.toLocaleString()} URLs match (out of {preview.totalUrls.toLocaleString()} total)
              </h4>
              {preview.sampleUrls.length > 0 && (
                <div>
                  <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>Sample URLs:</div>
                  <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#475569' }}>
                    {preview.sampleUrls.map((url, idx) => (
                      <li key={idx} style={{ marginBottom: 4 }}>{url}</li>
                    ))}
                  </ul>
                  {preview.count > 10 && (
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8 }}>
                      ...and {(preview.count - 10).toLocaleString()} more
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={handleSaveGroup}
              disabled={saving}
              style={{
                padding: '10px 20px',
                background: saving ? '#94a3b8' : '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: saving ? 'not-allowed' : 'pointer',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {saving ? '⏳ Matching URLs...' : editingGroupId ? 'Update Group' : 'Save Group'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingGroupId(null);
                setGroupName('');
                setConditions([{ type: 'inclusion', operator: 'contains', value: '' }]);
                setPreview(null);
              }}
              style={{
                padding: '10px 20px',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                background: '#fff',
                color: '#475569',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Content Groups List */}
      {loading && <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading content groups...</div>}

      {!loading && !showForm && groups.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📁</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600 }}>No Content Groups Yet</h3>
          <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
            Create your first content group to start analyzing page groups.
          </p>
        </div>
      )}

      {!loading && groups.length > 0 && !showForm && (
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Rules</th>
                <th style={thStyle}>URL Count</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={tdStyle}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{group.name}</div>
                    <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                      Created {new Date(group.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ fontSize: 13, color: '#475569' }}>{formatConditionSummary(group)}</div>
                  </td>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{group.urlCount.toLocaleString()}</span>
                  </td>
                  <td style={tdStyle}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleEdit(group)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          color: '#475569',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleRefresh(group)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          color: '#0f172a',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        title="Re-fetch matching URLs from Search Console"
                      >
                        🔄 Refresh
                      </button>
                      <button
                        onClick={() => handleDelete(group.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 6,
                          border: '1px solid #fecaca',
                          background: '#fff',
                          color: '#dc2626',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

const thStyle: React.CSSProperties = {
  padding: '12px 16px',
  textAlign: 'left',
  fontSize: 12,
  fontWeight: 600,
  color: '#64748b',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const tdStyle: React.CSSProperties = {
  padding: '16px',
  fontSize: 14,
  color: '#0f172a',
};

