'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import PortfolioBalance from '@/components/PortfolioBalance';

export default function AnalyticsPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth');
    }
  }, [user, isLoading, router]);

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
              <h1 className="text-xl font-bold text-white">Analytics</h1>
              <p className="text-sm text-gray-400">Market insights and trading analytics</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Account Balance</p>
              <PortfolioBalance />
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-white mb-4">Trading Performance</h3>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-400">Win Rate</span>
                  <span className="text-green-400 font-medium">73.2%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Average Trade</span>
                  <span className="text-white font-medium">$45.67</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Total Trades</span>
                  <span className="text-white font-medium">156</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Profit Factor</span>
                  <span className="text-green-400 font-medium">2.34</span>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-white mb-4">Market Sentiment</h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-400">Fear & Greed Index</span>
                    <span className="text-orange-400 font-medium">42 (Fear)</span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div className="bg-orange-400 h-2 rounded-full" style={{ width: '42%' }}></div>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">BTC Dominance</span>
                  <span className="text-white font-medium">45.7%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Active Addresses</span>
                  <span className="text-green-400 font-medium">+12.4%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-medium text-white mb-4">Recent Analysis</h3>
            <div className="space-y-4">
              <div className="border-b border-gray-700 pb-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-white font-medium">BTC Technical Analysis</h4>
                  <span className="text-sm text-gray-400">2 hours ago</span>
                </div>
                <p className="text-gray-400 text-sm">
                  Bitcoin is showing strong resistance at $45,000. RSI indicates oversold conditions, 
                  suggesting a potential bounce in the short term.
                </p>
              </div>
              
              <div className="border-b border-gray-700 pb-4">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-white font-medium">ETH Market Update</h4>
                  <span className="text-sm text-gray-400">4 hours ago</span>
                </div>
                <p className="text-gray-400 text-sm">
                  Ethereum network activity continues to increase with DeFi protocols showing 
                  renewed interest. Support level at $2,800 remains strong.
                </p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}