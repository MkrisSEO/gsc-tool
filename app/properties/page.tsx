'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Site {
  siteUrl: string;
  permissionLevel: string;
}

export default function PropertiesPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  useEffect(() => {
    if (status === 'authenticated') {
      fetch('/api/search-console/sites')
        .then((res) => res.json())
        .then((data) => {
          if (data.error) {
            setError(data.error);
          } else {
            setSites(data.sites || []);
          }
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [status]);

  const handlePropertyClick = (siteUrl: string) => {
    router.push(`/dashboard?site=${encodeURIComponent(siteUrl)}`);
  };

  if (status === 'loading' || loading) {
    return (
      <main style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: '#00121F'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, color: 'rgba(255, 255, 255, 0.7)' }}>Loading properties...</div>
        </div>
      </main>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <main style={{ 
      minHeight: '100vh',
      background: '#00121F',
      padding: '32px 24px'
    }}>
      {/* Header with Logo */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.06)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: 16,
          padding: '16px 24px',
          marginBottom: 32,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        {/* Morningbound Logo */}
        <Link href="/properties" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: '#0071E3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 700,
              color: '#FFFFFF',
              fontStyle: 'italic',
              boxShadow: '0 4px 12px rgba(0, 113, 227, 0.3)',
            }}
          >
            B
          </div>
          <span style={{ fontSize: 19, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.8px' }}>
            morningbound
          </span>
          <span style={{ fontSize: 14, fontWeight: 500, color: 'rgba(255, 255, 255, 0.5)', marginLeft: 8 }}>
            GSC Tool
          </span>
        </Link>

        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="btn-danger"
        >
          Sign Out
        </button>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ 
            margin: 0, 
            fontSize: 36, 
            fontWeight: 700,
            color: '#FFFFFF',
            marginBottom: 8
          }}>
            Select a Property
          </h1>
          <p style={{ 
            margin: 0, 
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: 16
          }}>
            Signed in as {session.user?.email}
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: 20,
              background: 'rgba(220, 38, 38, 0.1)',
              color: '#FF6B6B',
              borderRadius: 12,
              marginBottom: 24,
              border: '1px solid rgba(220, 38, 38, 0.3)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <strong style={{ color: '#FFFFFF' }}>Error loading properties:</strong> {error}
          </div>
        )}

        {sites.length === 0 && !error && (
          <div
            style={{
              padding: 32,
              background: 'rgba(255, 212, 59, 0.1)',
              borderRadius: 16,
              border: '1px solid rgba(255, 212, 59, 0.3)',
              textAlign: 'center',
              backdropFilter: 'blur(10px)',
            }}
          >
            <h3 style={{ margin: '0 0 12px', color: '#FFD43B', fontSize: 20, fontWeight: 700 }}>No Properties Found</h3>
            <p style={{ margin: 0, color: 'rgba(255, 255, 255, 0.7)' }}>
              Make sure you have verified properties in Google Search Console.
            </p>
          </div>
        )}

        {sites.length > 0 && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', 
            gap: 24
          }}>
            {sites.map((site) => (
              <div
                key={site.siteUrl}
                onClick={() => handlePropertyClick(site.siteUrl)}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  backdropFilter: 'blur(10px)',
                  padding: 24,
                  borderRadius: 16,
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  cursor: 'pointer',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-4px)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = '#0071E3';
                  e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 113, 227, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start',
                  gap: 16
                }}>
                  <div style={{
                    minWidth: 48,
                    height: 48,
                    background: 'linear-gradient(135deg, #0071E3 0%, #0056B3 100%)',
                    borderRadius: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24,
                    boxShadow: '0 4px 12px rgba(0, 113, 227, 0.3)',
                  }}>
                    🌐
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ 
                      margin: '0 0 10px', 
                      fontSize: 17, 
                      fontWeight: 700,
                      color: '#FFFFFF',
                      wordBreak: 'break-all',
                      lineHeight: 1.4
                    }}>
                      {site.siteUrl}
                    </h3>
                    <div style={{ 
                      display: 'inline-block',
                      padding: '6px 12px',
                      background: 'rgba(0, 113, 227, 0.2)',
                      color: '#66A3FF',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      border: '1px solid rgba(0, 113, 227, 0.3)',
                    }}>
                      {site.permissionLevel}
                    </div>
                  </div>
                  <div style={{ color: 'rgba(255, 255, 255, 0.4)', fontSize: 24, fontWeight: 300 }}>→</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
