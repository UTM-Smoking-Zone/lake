'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const [BtcCandles, setBtcCandles] = useState<any>(null);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    // Import component only on client side
    import('../../components/BtcCandles').then((mod) => {
      setBtcCandles(() => mod.default);
    });
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Trading Dashboard</h1>
            {user && (
              <p className="text-sm text-gray-400">
                Welcome, {user.firstName || user.email}
              </p>
            )}
          </div>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">BTC/USDT — Candlesticks</h2>
          <p className="text-gray-400">Real-time cryptocurrency trading data</p>
        </div>

        {BtcCandles ? (
          <BtcCandles backendBaseUrl="http://localhost:3001" />
        ) : (
          <div className="w-full h-[520px] flex items-center justify-center bg-gray-800 rounded-lg border border-gray-700">
            <div className="text-gray-400">Loading chart...</div>
          </div>
        )}
      </main>
    </div>
  );
}
