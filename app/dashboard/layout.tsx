'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { PropsWithChildren, useMemo } from 'react';

const TABS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Rank Tracker', href: '/dashboard/rank-tracker' },
  { label: 'Indexing', href: '/dashboard/indexing' },
  { label: 'Annotations', href: '/dashboard/annotations' },
  { label: 'Optimize', href: '/dashboard/optimize' },
  { label: 'GEO', href: '/dashboard/geo' },
  { label: 'Settings', href: '/dashboard/settings' },
];

export default function DashboardLayout({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const preservedParams = useMemo(() => {
    const params = new URLSearchParams();
    const site = searchParams.get('site');
    if (site) {
      params.set('site', site);
    }
    return params.toString();
  }, [searchParams]);

  const buildHref = (href: string) => {
    if (!preservedParams) return href;
    return `${href}?${preservedParams}`;
  };

  return (
    <div style={{ minHeight: '100vh', background: '#00121F' }}>
      <header
        style={{
          background: 'rgba(255, 255, 255, 0.04)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(0, 113, 227, 0.15)',
        }}
      >
        <nav
          aria-label="Dashboard sections"
          style={{
            display: 'flex',
            gap: 32,
            padding: '0 32px',
            minHeight: 64,
            alignItems: 'center',
          }}
        >
          {/* Morningbound Logo */}
          <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, marginRight: 32 }}>
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

          {/* Navigation Tabs */}
          {TABS.map((tab) => {
            const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (
              <Link
                key={tab.href}
                href={buildHref(tab.href)}
                style={{
                  display: 'inline-flex',
                  height: '100%',
                  alignItems: 'center',
                  padding: '0 12px',
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.7)',
                  borderBottom: isActive ? '3px solid #0071E3' : '3px solid transparent',
                  textDecoration: 'none',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  letterSpacing: '0.01em',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = '#FFFFFF';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                  }
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
    </div>
  );
}


