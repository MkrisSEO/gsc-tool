'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function HomePage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const error = (searchParams?.error as string) || '';
  const showDenied = error === 'AccessDenied';

  useEffect(() => {
    if (status === 'authenticated') {
      router.push('/properties');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <main style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: 18 }}>Loading...</div>
        </div>
      </main>
    );
  }

  return (
    <main style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <div style={{ 
        background: '#fff', 
        padding: '48px 64px', 
        borderRadius: 16, 
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        textAlign: 'center',
        maxWidth: 500
      }}>
        <h1 style={{ 
          marginBottom: 16, 
          fontSize: 36, 
          fontWeight: 700,
          color: '#1f2937'
        }}>
          SEO Tracking Tool
        </h1>
        <p style={{ 
          marginBottom: 32, 
          color: '#6b7280',
          fontSize: 16,
          lineHeight: 1.6
        }}>
          Sign in with your Google account to access your Search Console properties and track your SEO performance.
        </p>
        {showDenied && (
          <div style={{ 
            marginBottom: 24, 
            padding: 16, 
            border: '1px solid #dc2626', 
            background: '#fef2f2', 
            color: '#991b1b', 
            borderRadius: 8,
            fontSize: 14
          }}>
            Access denied. Please try again with a Google account that has Search Console properties.
          </div>
        )}
        <a 
          href="/api/auth/signin/google" 
          style={{ 
            display: 'inline-flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 28px', 
            background: '#fff',
            border: '2px solid #e5e7eb',
            borderRadius: 8, 
            textDecoration: 'none',
            fontSize: 16,
            fontWeight: 600,
            color: '#1f2937',
            transition: 'all 0.2s',
            cursor: 'pointer'
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.6 10.227c0-.709-.064-1.39-.182-2.045H10v3.868h5.382a4.6 4.6 0 01-1.996 3.018v2.51h3.232c1.891-1.742 2.982-4.305 2.982-7.35z" fill="#4285F4"/>
            <path d="M10 20c2.7 0 4.964-.895 6.618-2.423l-3.232-2.509c-.895.6-2.04.955-3.386.955-2.605 0-4.81-1.76-5.595-4.123H1.064v2.59A9.996 9.996 0 0010 20z" fill="#34A853"/>
            <path d="M4.405 11.9c-.2-.6-.314-1.24-.314-1.9 0-.66.114-1.3.314-1.9V5.51H1.064A9.996 9.996 0 000 10c0 1.614.386 3.14 1.064 4.49l3.34-2.59z" fill="#FBBC05"/>
            <path d="M10 3.977c1.468 0 2.786.505 3.823 1.496l2.868-2.868C14.959.99 12.695 0 10 0 6.09 0 2.71 2.24 1.064 5.51l3.34 2.59C5.19 5.737 7.395 3.977 10 3.977z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </a>
      </div>
    </main>
  );
}
