'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

interface Portfolio {
  id: string;
  name: string;
  base_currency_code: string;
  balances: Balance[];
}

interface Balance {
  qty: string;
  asset_code: string;
  asset_name: string;
}

export default function PortfolioPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [cryptoPrices, setCryptoPrices] = useState<Record<string, number>>({});
  const [totalValue, setTotalValue] = useState(0);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // API endpoints
  const PORTFOLIO_API = 'http://localhost:8001';

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth');
    } else if (user) {
      fetchPortfolioData();
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    // Fetch prices and refresh every 30 seconds
    fetchCryptoPrices();
    const priceInterval = setInterval(fetchCryptoPrices, 30000);
    return () => clearInterval(priceInterval);
  }, []);

  useEffect(() => {
    // Recalculate total value when portfolio or prices change
    if (portfolio && Object.keys(cryptoPrices).length > 0) {
      calculateTotalValue();
    }
  }, [portfolio, cryptoPrices]);

  const fetchPortfolioData = async () => {
    if (!user?.id) return;
    
    try {
      setIsLoadingData(true);
      const response = await fetch(`${PORTFOLIO_API}/portfolio/${user.id}`, {
        headers: {
          'x-user-id': user.id
        }
      });
      if (response.ok) {
        const portfolios = await response.json();
        if (portfolios.length > 0) {
          setPortfolio(portfolios[0]);
        }
      }
    } catch (error) {
      console.error('Failed to fetch portfolio:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchCryptoPrices = async () => {
    try {
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'SOLUSDT', 'ADAUSDT', 'DOGEUSDT', 'TRXUSDT', 'MATICUSDT', 'AVAXUSDT'];
      const pricesPromises = symbols.map(async (symbol) => {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        const data = await response.json();
        return { symbol, price: parseFloat(data.price) };
      });
      
      const pricesData = await Promise.all(pricesPromises);
      const pricesMap: Record<string, number> = {};
      
      pricesData.forEach(({ symbol, price }) => {
        const coinCode = symbol.replace('USDT', '');
        pricesMap[coinCode] = price;
      });
      
      // Add stablecoins at $1
      pricesMap['USDT'] = 1;
      pricesMap['USDC'] = 1;
      pricesMap['USD'] = 1;
      
      setCryptoPrices(pricesMap);
    } catch (error) {
      console.error('Failed to fetch crypto prices:', error);
    }
  };

  const calculateTotalValue = () => {
    if (!portfolio) return;
    
    let total = 0;
    portfolio.balances.forEach(balance => {
      const price = cryptoPrices[balance.asset_code] || 0;
      const quantity = parseFloat(balance.qty);
      total += price * quantity;
    });
    
    setTotalValue(total);
  };

  const getAssetValue = (balance: Balance) => {
    const price = cryptoPrices[balance.asset_code] || 0;
    const quantity = parseFloat(balance.qty);
    return price * quantity;
  };

  const getTotalAssets = () => {
    return portfolio?.balances?.filter(b => parseFloat(b.qty) > 0).length || 0;
  };

  if (isLoading || isLoadingData) {
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
              <p className="text-xl font-bold text-green-400">
                ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-white mb-2">Total Value</h3>
              <p className="text-3xl font-bold text-green-400">
                ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-sm text-gray-400 mt-1">Live market value</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-white mb-2">Assets</h3>
              <p className="text-3xl font-bold text-white">{getTotalAssets()}</p>
              <p className="text-sm text-gray-400 mt-1">Active positions</p>
            </div>
            
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h3 className="text-lg font-medium text-white mb-2">Diversification</h3>
              <p className="text-3xl font-bold text-blue-400">{getTotalAssets()}</p>
              <p className="text-sm text-gray-400 mt-1">Different cryptocurrencies</p>
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-medium text-white mb-4">Holdings</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead>
                  <tr className="border-b border-gray-700">
                    <th className="py-2 text-gray-400 font-medium">Asset</th>
                    <th className="py-2 text-gray-400 font-medium">Name</th>
                    <th className="py-2 text-gray-400 font-medium">Amount</th>
                    <th className="py-2 text-gray-400 font-medium">Price</th>
                    <th className="py-2 text-gray-400 font-medium">Value</th>
                    <th className="py-2 text-gray-400 font-medium">Allocation</th>
                  </tr>
                </thead>
                <tbody className="text-white">
                  {portfolio?.balances
                    ?.filter(balance => parseFloat(balance.qty) > 0)
                    ?.sort((a, b) => getAssetValue(b) - getAssetValue(a))
                    ?.map((balance) => {
                      const price = cryptoPrices[balance.asset_code] || 0;
                      const value = getAssetValue(balance);
                      const allocation = totalValue > 0 ? (value / totalValue) * 100 : 0;
                      
                      return (
                        <tr key={balance.asset_code} className="border-b border-gray-700 hover:bg-gray-700/50">
                          <td className="py-3 font-medium">
                            <div className="flex items-center">
                              <div className="w-8 h-8 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full flex items-center justify-center mr-3">
                                <span className="text-xs font-bold text-white">{balance.asset_code.substring(0, 2)}</span>
                              </div>
                              {balance.asset_code}
                            </div>
                          </td>
                          <td className="py-3 text-gray-300">{balance.asset_name}</td>
                          <td className="py-3">{parseFloat(balance.qty).toFixed(balance.asset_code === 'BTC' ? 8 : 2)}</td>
                          <td className="py-3">
                            ${price > 0 ? price.toLocaleString(undefined, { 
                              minimumFractionDigits: price < 1 ? 4 : 2, 
                              maximumFractionDigits: price < 1 ? 4 : 2 
                            }) : 'N/A'}
                          </td>
                          <td className="py-3 text-green-400 font-medium">
                            ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3">
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-600 rounded-full h-2 mr-2">
                                <div 
                                  className="bg-blue-500 h-2 rounded-full" 
                                  style={{ width: `${Math.min(allocation, 100)}%` }}
                                ></div>
                              </div>
                              <span className="text-sm">{allocation.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {(!portfolio?.balances || portfolio.balances.length === 0) && (
                <div className="text-center py-8 text-gray-400">
                  No holdings found
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}