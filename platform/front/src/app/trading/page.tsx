'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
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
    <div className="flex min-h-screen bg-gray-900">
      <Sidebar />
      
      <div className="flex-1 flex flex-col">
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-xl font-bold text-white">Trading Dashboard</h1>
              <p className="text-sm text-gray-400">Advanced trading tools and charts</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Account Balance</p>
              <p className="text-xl font-bold text-green-400">$12,459.30</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">
          <div className="mb-6">
            <h2 className="text-2xl font-bold mb-2 text-white">BTC/USDT — Candlesticks</h2>
            <p className="text-gray-400">Real-time cryptocurrency trading data</p>
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            {BtcCandles ? (
              <BtcCandles backendBaseUrl="http://localhost:3001" />
            ) : (
              <div className="w-full h-[520px] flex items-center justify-center">
                <div className="text-gray-400">Loading chart...</div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
