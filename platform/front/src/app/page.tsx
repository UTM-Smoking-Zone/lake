'use client';

import { useEffect, useState } from 'react';

export default function Page() {
  const [BtcCandles, setBtcCandles] = useState<any>(null);

  useEffect(() => {
    // Import component only on client side
    import('../components/BtcCandles').then((mod) => {
      setBtcCandles(() => mod.default);
    });
  }, []);

  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ margin: 0, marginBottom: 12, fontSize: 22 }}>BTC/USDT — Candlesticks</h1>
      {BtcCandles ? (
        <BtcCandles backendBaseUrl="http://localhost:3001" />
      ) : (
        <div style={{
          width: '100%',
          height: 520,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b0f14',
          color: '#e6e9ef',
          borderRadius: 8
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
            <div>Loading chart...</div>
          </div>
        </div>
      )}
    </main>
  );
}
