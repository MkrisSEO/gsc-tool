'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import AdvancedDateRangeSelector from '@/components/AdvancedDateRangeSelector';
import AnnotationModal, { AnnotationFormData } from '@/components/AnnotationModal';

interface Annotation {
  id: string;
  date: string;
  title: string;
  description: string;
  scope: 'all' | 'specific' | 'content_group';
  urls?: string[];
  contentGroupId?: string;
  createdAt: string;
  createdBy: string;
  siteUrl: string;
}

interface ImpactMetrics {
  before: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  after: {
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  };
  changes: {
    clicks: { absolute: number; percent: number };
    impressions: { absolute: number; percent: number };
    ctr: { absolute: number; percent: number };
    position: { absolute: number; percent: number };
  };
  chartData: Array<{
    date: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
}

export default function AnnotationsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedSite, setSelectedSite] = useState('');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [impactData, setImpactData] = useState<Map<string, ImpactMetrics>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState({ startDate: '', endDate: '' });
  const [compareRange, setCompareRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [showAnnotationModal, setShowAnnotationModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
      fetchAnnotations();
    }
  }, [selectedSite, dateRange, compareRange]);

  const fetchAnnotations = async () => {
    if (!selectedSite) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/annotations?siteUrl=${encodeURIComponent(selectedSite)}`);
      const json = await response.json();
      
      if (response.ok && json.annotations) {
        setAnnotations(json.annotations);
        
        // Fetch impact metrics for each annotation
        const impacts = new Map<string, ImpactMetrics>();
        for (const annotation of json.annotations) {
          try {
            const impactUrl = new URL('/api/annotations/impact', window.location.origin);
            impactUrl.searchParams.set('siteUrl', selectedSite);
            impactUrl.searchParams.set('date', annotation.date);
            impactUrl.searchParams.set('scope', annotation.scope);
            if (annotation.urls && annotation.urls.length > 0) {
              impactUrl.searchParams.set('urls', annotation.urls.join(','));
            }
            
            // Add custom date ranges if selected
            if (dateRange.startDate && dateRange.endDate) {
              impactUrl.searchParams.set('startDate', dateRange.startDate);
              impactUrl.searchParams.set('endDate', dateRange.endDate);
            }
            if (compareRange) {
              impactUrl.searchParams.set('compareStartDate', compareRange.startDate);
              impactUrl.searchParams.set('compareEndDate', compareRange.endDate);
            }
            
            const impactResponse = await fetch(impactUrl.toString());
            if (impactResponse.ok) {
              const impactJson = await impactResponse.json();
              impacts.set(annotation.id, impactJson);
            }
          } catch (impactError) {
            console.error(`Failed to fetch impact for annotation ${annotation.id}:`, impactError);
          }
        }
        setImpactData(impacts);
      } else {
        throw new Error(json.error || 'Failed to fetch annotations');
      }
    } catch (err) {
      console.error('Failed to fetch annotations:', err);
      setError(err instanceof Error ? err.message : 'Unexpected error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnotation = async (formData: AnnotationFormData) => {
    try {
      const response = await fetch('/api/annotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          siteUrl: selectedSite,
        }),
      });

      const json = await response.json();
      
      if (response.ok && json.annotation) {
        setShowAnnotationModal(false);
        setSelectedDate(null);
        fetchAnnotations(); // Refresh the list
        alert('✅ Annotation created successfully!');
      } else {
        throw new Error(json.error || 'Failed to create annotation');
      }
    } catch (error) {
      console.error('Failed to create annotation:', error);
      alert('❌ Failed to create annotation: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleDelete = async (annotationId: string) => {
    if (!confirm('Are you sure you want to delete this annotation?')) {
      return;
    }

    try {
      const response = await fetch(`/api/annotations?id=${annotationId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setAnnotations(annotations.filter((a) => a.id !== annotationId));
        setImpactData((prev) => {
          const next = new Map(prev);
          next.delete(annotationId);
          return next;
        });
        alert('✅ Annotation deleted');
      } else {
        const json = await response.json();
        throw new Error(json.error || 'Failed to delete annotation');
      }
    } catch (error) {
      console.error('Failed to delete annotation:', error);
      alert('❌ Failed to delete: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const formatScopeLabel = (annotation: Annotation) => {
    if (annotation.scope === 'all') return 'All Pages';
    if (annotation.scope === 'specific') return `${annotation.urls?.length || 0} Specific Page(s)`;
    if (annotation.scope === 'content_group') return `Content Group: ${annotation.contentGroupId}`;
    return annotation.scope;
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

  const sortedAnnotations = [...annotations].sort((a, b) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <main style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
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
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Annotations</h1>
          <p style={{ margin: '8px 0 0', color: '#6b7280' }}>{selectedSite}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            onClick={() => {
              setSelectedDate(new Date().toISOString().split('T')[0]);
              setShowAnnotationModal(true);
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
            Create Annotation
          </button>
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

      {selectedSite && (
        <AdvancedDateRangeSelector
          dateRange={dateRange}
          compareRange={compareRange}
          onDateChange={(startDate, endDate) => {
            setDateRange({ startDate, endDate });
          }}
          onCompareChange={setCompareRange}
        />
      )}

      <AnnotationModal
        isOpen={showAnnotationModal}
        selectedDate={selectedDate}
        onClose={() => {
          setShowAnnotationModal(false);
          setSelectedDate(null);
        }}
        onSave={handleCreateAnnotation}
      />

      {error && (
        <div
          style={{
            padding: 16,
            background: '#fee2e2',
            color: '#b91c1c',
            borderRadius: 8,
            marginBottom: 24,
          }}
        >
          {error}
        </div>
      )}

      {loading && (
        <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading annotations...</div>
      )}

      {!loading && sortedAnnotations.length === 0 && (
        <div style={{ padding: 60, textAlign: 'center', background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📌</div>
          <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 600 }}>No annotations yet</h3>
          <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 14 }}>
            Track important events and changes that affect your site's performance.
          </p>
          <button
            onClick={() => {
              setSelectedDate(new Date().toISOString().split('T')[0]);
              setShowAnnotationModal(true);
            }}
            style={{
              padding: '12px 24px',
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Create Your First Annotation
          </button>
        </div>
      )}

      {!loading && sortedAnnotations.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {sortedAnnotations.map((annotation) => {
            const impact = impactData.get(annotation.id);
            const hasImpact = !!impact;

            return (
              <div
                key={annotation.id}
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  overflow: 'hidden',
                }}
              >
                <div style={{ padding: 24, borderBottom: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{annotation.title}</h3>
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: 999,
                            background: '#f1f5f9',
                            color: '#475569',
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {new Date(annotation.date).toLocaleDateString()}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 8px', color: '#64748b', fontSize: 14 }}>
                        {formatScopeLabel(annotation)}
                      </p>
                      {annotation.description && (
                        <p style={{ margin: 0, color: '#475569', fontSize: 14 }}>{annotation.description}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => router.push(`/dashboard?site=${encodeURIComponent(selectedSite)}`)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
                          border: '1px solid #cbd5e1',
                          background: '#fff',
                          color: '#475569',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        View in Dashboard
                      </button>
                      <button
                        onClick={() => handleDelete(annotation.id)}
                        style={{
                          padding: '6px 12px',
                          borderRadius: 8,
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
                  </div>
                </div>

                {hasImpact && impact && (
                  <div style={{ padding: 24 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                      {/* Clicks */}
                      <div style={{ padding: 16, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Clicks</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                          {impact.after.clicks.toLocaleString()}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: impact.changes.clicks.percent >= 0 ? '#15803d' : '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span>{impact.changes.clicks.percent >= 0 ? '↑' : '↓'}</span>
                          <span>
                            {impact.changes.clicks.absolute.toLocaleString()} ({impact.changes.clicks.percent >= 0 ? '+' : ''}{impact.changes.clicks.percent.toFixed(1)}%)
                          </span>
                        </div>
                      </div>

                      {/* Impressions */}
                      <div style={{ padding: 16, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Impressions</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                          {impact.after.impressions.toLocaleString()}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: impact.changes.impressions.percent >= 0 ? '#15803d' : '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span>{impact.changes.impressions.percent >= 0 ? '↑' : '↓'}</span>
                          <span>
                            {impact.changes.impressions.absolute.toLocaleString()} ({impact.changes.impressions.percent >= 0 ? '+' : ''}{impact.changes.impressions.percent.toFixed(1)}%)
                          </span>
                        </div>
                      </div>

                      {/* CTR */}
                      <div style={{ padding: 16, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>CTR</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                          {(impact.after.ctr * 100).toFixed(2)}%
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: impact.changes.ctr.percent >= 0 ? '#15803d' : '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span>{impact.changes.ctr.percent >= 0 ? '↑' : '↓'}</span>
                          <span>
                            {impact.changes.ctr.percent >= 0 ? '+' : ''}{(impact.changes.ctr.absolute * 100).toFixed(2)}pp ({impact.changes.ctr.percent.toFixed(1)}%)
                          </span>
                        </div>
                      </div>

                      {/* Position */}
                      <div style={{ padding: 16, borderRadius: 8, background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Avg. Position</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 6 }}>
                          {impact.after.position.toFixed(1)}
                        </div>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: impact.changes.position.percent <= 0 ? '#15803d' : '#dc2626',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <span>{impact.changes.position.percent <= 0 ? '↓' : '↑'}</span>
                          <span>
                            {impact.changes.position.percent >= 0 ? '+' : ''}{impact.changes.position.absolute.toFixed(1)} ({impact.changes.position.percent.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Mini trend chart */}
                    <div style={{ height: 120 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={impact.chartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis
                            dataKey="date"
                            tick={{ fontSize: 11 }}
                            tickFormatter={(value) => {
                              const date = new Date(value);
                              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            }}
                          />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            formatter={(value: number) => value.toLocaleString()}
                            labelFormatter={(label) => new Date(label).toLocaleDateString()}
                          />
                          <Line
                            type="monotone"
                            dataKey="clicks"
                            stroke="#2563eb"
                            strokeWidth={2}
                            dot={false}
                          />
                          {/* Annotation marker line */}
                          {impact.chartData.map((point, index) => {
                            if (point.date === annotation.date) {
                              return (
                                <line
                                  key={`marker-${index}`}
                                  x1={`${(index / impact.chartData.length) * 100}%`}
                                  x2={`${(index / impact.chartData.length) * 100}%`}
                                  y1="0%"
                                  y2="100%"
                                  stroke="#f59e0b"
                                  strokeWidth={2}
                                  strokeDasharray="4 4"
                                />
                              );
                            }
                            return null;
                          })}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                {!hasImpact && (
                  <div style={{ padding: 24, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
                    Loading impact metrics...
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

