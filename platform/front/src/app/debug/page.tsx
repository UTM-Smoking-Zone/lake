'use client';

import dynamic from 'next/dynamic';

const SimpleChart = dynamic(() => import('../../components/SimpleChart'), { ssr: false });

export default function DebugPage() {
  return (
    <main style={{ padding: 16 }}>
      <h1>Debug Page - Chart Test</h1>
      <SimpleChart backendBaseUrl="http://localhost:3001" />
    </main>
  );
}
