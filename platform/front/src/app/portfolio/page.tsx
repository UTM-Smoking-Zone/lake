'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

interface Balance {
  asset_id: number;
  asset_symbol: string;
  available: string;
  locked: string;
}

interface Portfolio {
  id: number;
  name: string;
  currency: string;
  balances: Balance[];
}

export default function PortfolioPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch portfolio data from API
  useEffect(() => {
    const fetchPortfolios = async () => {
      if (!user) return;

      setLoading(true);
      setError(null);

      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`http://localhost:8000/api/portfolio/${user.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch portfolios');
        }

        const data = await response.json();
        setPortfolios(data.portfolios || []);
      } catch (err) {
        console.error('Error fetching portfolios:', err);
        setError(err instanceof Error ? err.message : 'Failed to load portfolio data');
      } finally {
        setLoading(false);
      }
    };

    fetchPortfolios();
  }, [user]);

  // Auth protection
  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth');
    }
  }, [user, isLoading, router]);

  if (isLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-red-400 text-xl">Error: {error}</div>
      </div>
    );
  }

  // Calculate totals from real data
  const totalValue = portfolios.reduce((sum, portfolio) => {
    const portfolioValue = portfolio.balances.reduce((pSum, balance) => {
      return pSum + parseFloat(balance.available) + parseFloat(balance.locked);
    }, 0);
    return sum + portfolioValue;
  }, 0);

  const totalAssets = portfolios.reduce((sum, portfolio) => {
    return sum + portfolio.balances.filter(b => parseFloat(b.available) > 0 || parseFloat(b.locked) > 0).length;
  }, 0);

  const allBalances = portfolios.flatMap(p =>
    p.balances.map(b => ({ ...b, portfolioName: p.name }))
  ).filter(b => parseFloat(b.available) > 0 || parseFloat(b.locked) > 0);

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
              <p className="text-xl font-bold text-green-400">${totalValue.toFixed(2)}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-white mb-2">Total Value</h3>
              <p className="text-3xl font-bold text-green-400">${totalValue.toFixed(2)}</p>
              <p className="text-sm text-gray-400 mt-1">All portfolios</p>
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-white mb-2">Portfolios</h3>
              <p className="text-3xl font-bold text-white">{portfolios.length}</p>
              <p className="text-sm text-gray-400 mt-1">Active portfolios</p>
            </div>

            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-white mb-2">Assets</h3>
              <p className="text-3xl font-bold text-white">{totalAssets}</p>
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
                  {allBalances.length > 0 ? (
                    allBalances.map((balance, index) => {
                      const total = parseFloat(balance.available) + parseFloat(balance.locked);
                      return (
                        <tr key={index} className="border-b border-gray-700">
                          <td className="py-3">
                            {balance.asset_symbol}
                            <span className="text-xs text-gray-400 ml-2">({balance.portfolioName})</span>
                          </td>
                          <td className="py-3">{parseFloat(balance.available).toFixed(8)}</td>
                          <td className="py-3">${total.toFixed(2)}</td>
                          <td className="py-3 text-gray-400">-</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-gray-400">
                        No holdings found. Start trading to build your portfolio!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}