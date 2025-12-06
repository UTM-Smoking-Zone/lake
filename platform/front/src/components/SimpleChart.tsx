'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export default function SimpleChart({ backendBaseUrl }: { backendBaseUrl: string }) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [lastKline, setLastKline] = useState<any>(null);
  const [status, setStatus] = useState('Loading...');

  useEffect(() => {
    console.log('📊 Fetching candles from', `${backendBaseUrl}/candles`);

    // Fetch historical data
    fetch(`${backendBaseUrl}/candles?symbol=BTCUSDT&interval=1m&limit=100`)
      .then(r => r.json())
      .then((data: Candle[]) => {
        console.log(`✅ Loaded ${data.length} candles`);
        setCandles(data);
        setStatus(`Loaded ${data.length} candles`);
      })
      .catch((err) => {
        console.error('❌ Error fetching candles:', err);
        setStatus('Error loading candles: ' + err.message);
      });

    // Connect to Socket.IO
    console.log('🔌 Connecting to Socket.IO:', `${backendBaseUrl}/market`);
    const socket = io(`${backendBaseUrl}/market`, {
      transports: ['polling', 'websocket'],
    });

    socket.on('connect', () => {
      console.log('✅ Socket.IO connected');
      setStatus(prev => prev + ' | Socket.IO connected');
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Socket.IO error:', err.message);
      setStatus(prev => prev + ' | Socket.IO error');
    });

    socket.on('kline', (k: any) => {
      console.log('📈 Received kline update:', k.close);
      setLastKline(k);
    });

    return () => {
      socket.disconnect();
    };
  }, [backendBaseUrl]);

  return (
    <div style={{ width: '100%', padding: 20, background: '#f5f5f5', borderRadius: 8 }}>
      <h2>Chart Status</h2>
      <p><strong>Status:</strong> {status}</p>
      <p><strong>Candles loaded:</strong> {candles.length}</p>

      {lastKline && (
        <div style={{
          marginTop: 20,
          padding: 15,
          background: '#e0f7fa',
          borderRadius: 5
        }}>
          <h3>Latest Live Update:</h3>
          <p>Symbol: {lastKline.symbol}</p>
          <p>Time: {new Date(lastKline.time * 1000).toLocaleString()}</p>
          <p>Price: {lastKline.close}</p>
          <p>Interval: {lastKline.interval}</p>
        </div>
      )}

      {candles.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h3>First 5 Candles:</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#ddd' }}>
                <th style={{ padding: 8, border: '1px solid #ccc' }}>Time</th>
                <th style={{ padding: 8, border: '1px solid #ccc' }}>Open</th>
                <th style={{ padding: 8, border: '1px solid #ccc' }}>High</th>
                <th style={{ padding: 8, border: '1px solid #ccc' }}>Low</th>
                <th style={{ padding: 8, border: '1px solid #ccc' }}>Close</th>
              </tr>
            </thead>
            <tbody>
              {candles.slice(0, 5).map((c, i) => (
                <tr key={i}>
                  <td style={{ padding: 8, border: '1px solid #ccc' }}>
                    {new Date(c.time * 1000).toLocaleTimeString()}
                  </td>
                  <td style={{ padding: 8, border: '1px solid #ccc' }}>{c.open}</td>
                  <td style={{ padding: 8, border: '1px solid #ccc' }}>{c.high}</td>
                  <td style={{ padding: 8, border: '1px solid #ccc' }}>{c.low}</td>
                  <td style={{ padding: 8, border: '1px solid #ccc' }}>{c.close}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
