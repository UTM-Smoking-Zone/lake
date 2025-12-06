'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export default function SimplePage() {
  const [status, setStatus] = useState('Connecting...');
  const [kline, setKline] = useState<any>(null);

  useEffect(() => {
    console.log('🔌 Connecting to Socket.IO...');
    const socket = io('http://localhost:3001/market', {
      transports: ['polling', 'websocket'],
    });

    socket.on('connect', () => {
      console.log('✅ Connected!');
      setStatus('Connected ✅');
    });

    socket.on('connect_error', (err) => {
      console.error('❌ Connection error:', err);
      setStatus('Connection Error: ' + err.message);
    });

    socket.on('kline', (data) => {
      console.log('📈 Received kline:', data);
      setKline(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return (
    <div style={{ padding: 20, fontFamily: 'monospace' }}>
      <h1>Simple Socket.IO Test</h1>
      <p>Status: <strong>{status}</strong></p>

      {kline && (
        <div style={{
          marginTop: 20,
          padding: 15,
          background: '#f0f0f0',
          borderRadius: 5
        }}>
          <h2>Latest Kline Data:</h2>
          <pre style={{ fontSize: 14 }}>
            {JSON.stringify(kline, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
