import { Suspense } from 'react';

export default function QueryLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div>Loading...</div>}>{children}</Suspense>;
}

