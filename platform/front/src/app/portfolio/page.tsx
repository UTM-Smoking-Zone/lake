'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function PortfolioPage() {
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
              <h1 className="text-xl font-bold text-white">Portfolio</h1>
              <p className="text-sm text-gray-400">Track your investments and performance</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Account Balance</p>
              <p className="text-xl font-bold text-green-400">$12,459.30</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-white mb-2">Total Value</h3>
              <p className="text-3xl font-bold text-green-400">$12,459.30</p>
              <p className="text-sm text-green-400 mt-1">+5.67% (24h)</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-white mb-2">Total P&L</h3>
              <p className="text-3xl font-bold text-green-400">+$1,289.45</p>
              <p className="text-sm text-green-400 mt-1">+11.54%</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-white mb-2">Assets</h3>
              <p className="text-3xl font-bold text-white">7</p>
              <p className="text-sm text-gray-400 mt-1">Active positions</p>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-medium text-white mb-4">Holdings</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="py-2 text-gray-400 font-medium">Asset</th>
                    <th className="py-2 text-gray-400 font-medium">Amount</th>
                    <th className="py-2 text-gray-400 font-medium">Value</th>
                    <th className="py-2 text-gray-400 font-medium">P&L</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  <tr className="border-b border-gray-700">
                    <td className="py-3">BTC</td>
                    <td className="py-3">0.25</td>
                    <td className="py-3">$11,250.00</td>
                    <td className="py-3 text-green-400">+$1,125.00</td>
                  </tr>
                  <tr className="border-b border-gray-700">
                    <td className="py-3">ETH</td>
                    <td className="py-3">3.5</td>
                    <td className="py-3">$8,750.00</td>
                    <td className="py-3 text-green-400">+$875.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}