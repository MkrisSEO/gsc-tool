'use client';

import { useState } from 'react';

export interface AnnotationFormData {
  date: string;
  title: string;
  description: string;
  scope: 'all' | 'specific' | 'content_group';
  urls: string[];
  contentGroupId: string;
}

interface AnnotationModalProps {
  isOpen: boolean;
  selectedDate: string | null;
  onClose: () => void;
  onSave: (data: AnnotationFormData) => void;
}

export default function AnnotationModal({
  isOpen,
  selectedDate,
  onClose,
  onSave,
}: AnnotationModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [scope, setScope] = useState<'all' | 'specific' | 'content_group'>('all');
  const [urlsText, setUrlsText] = useState('');
  const [contentGroupId, setContentGroupId] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Please enter a title');
      return;
    }

    if (scope === 'specific' && !urlsText.trim()) {
      alert('Please enter at least one URL');
      return;
    }

    if (scope === 'content_group' && !contentGroupId.trim()) {
      alert('Please select a content group');
      return;
    }

    const urls = scope === 'specific'
      ? urlsText.split('\n').map((url) => url.trim()).filter(Boolean)
      : [];

    onSave({
      date: selectedDate || new Date().toISOString().split('T')[0],
      title: title.trim(),
      description: description.trim(),
      scope,
      urls,
      contentGroupId: scope === 'content_group' ? contentGroupId : '',
    });

    // Reset form
    setTitle('');
    setDescription('');
    setScope('all');
    setUrlsText('');
    setContentGroupId('');
  };

  const handleCancel = () => {
    setTitle('');
    setDescription('');
    setScope('all');
    setUrlsText('');
    setContentGroupId('');
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      onClick={handleCancel}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 32,
          maxWidth: 600,
          width: '90%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 24, fontWeight: 700 }}>
          Create Annotation
        </h2>
        <p style={{ margin: '0 0 24px', color: '#64748b', fontSize: 14 }}>
          Add a note for {selectedDate ? new Date(selectedDate).toLocaleDateString() : 'selected date'}
        </p>

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
              Title <span style={{ color: '#dc2626' }}>*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Launched new product page"
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                fontSize: 14,
                boxSizing: 'border-box',
              }}
              required
            />
          </div>

          {/* Description */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional: Add more details about what changed..."
              rows={4}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #cbd5e1',
                borderRadius: 8,
                fontSize: 14,
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Scope */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', marginBottom: 12, fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
              Which pages have been impacted?
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="radio"
                  value="all"
                  checked={scope === 'all'}
                  onChange={(e) => setScope(e.target.value as any)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14 }}>All Pages</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="radio"
                  value="specific"
                  checked={scope === 'specific'}
                  onChange={(e) => setScope(e.target.value as any)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14 }}>Specific Page(s)</span>
              </label>

              {scope === 'specific' && (
                <div style={{ marginLeft: 30, marginTop: 8 }}>
                  <textarea
                    value={urlsText}
                    onChange={(e) => setUrlsText(e.target.value)}
                    placeholder="Enter URLs (one per line)"
                    rows={5}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      fontSize: 13,
                      fontFamily: 'monospace',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input
                  type="radio"
                  value="content_group"
                  checked={scope === 'content_group'}
                  onChange={(e) => setScope(e.target.value as any)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: 14 }}>Content Group</span>
              </label>

              {scope === 'content_group' && (
                <div style={{ marginLeft: 30, marginTop: 8 }}>
                  <select
                    value={contentGroupId}
                    onChange={(e) => setContentGroupId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      border: '1px solid #cbd5e1',
                      borderRadius: 8,
                      fontSize: 14,
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="">Select a content group...</option>
                    <option value="blog">Blog Posts</option>
                    <option value="products">Product Pages</option>
                    <option value="landing">Landing Pages</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 32 }}>
            <button
              type="button"
              onClick={handleCancel}
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
            <button
              type="submit"
              style={{
                padding: '10px 20px',
                border: 'none',
                borderRadius: 8,
                background: '#2563eb',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Save Annotation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

