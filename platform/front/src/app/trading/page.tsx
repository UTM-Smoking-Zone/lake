'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import TradingFormSimple from '@/components/TradingFormSimple';

interface CoinData {
  name: string;
  symbol: string;
  icon: string;
  price: string;
  changePercent: number;
  changeColor: 'green' | 'red';
  volume: string;
  marketCap: string;
}

export default function TradingPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [TradingChart, setTradingChart] = useState<any>(null);
  const [coinsList, setCoinsList] = useState<CoinData[]>([]);
  const [selectedCoin, setSelectedCoin] = useState<string | null>(null);
  const [selectedCoinData, setSelectedCoinData] = useState<CoinData | null>(null);
  const [isLoadingCoins, setIsLoadingCoins] = useState(false);

  // Mapping of crypto symbols to Binance trading pairs
  const cryptoMapping = {
    BTC: 'BTCUSDT',
    ETH: 'ETHUSDT', 
    BNB: 'BNBUSDT',
    XRP: 'XRPUSDT',
    SOL: 'SOLUSDT',
    ADA: 'ADAUSDT',
    DOGE: 'DOGEUSDT',
    TRX: 'TRXUSDT',
    MATIC: 'MATICUSDT',
    AVAX: 'AVAXUSDT'
  };

  const cryptoConfig = [
    { name: 'Bitcoin', symbol: 'BTC', icon: '#F7931A' },
    { name: 'Ethereum', symbol: 'ETH', icon: '#627EEA' },
    { name: 'BNB', symbol: 'BNB', icon: '#F3BA2F' },
    { name: 'XRP', symbol: 'XRP', icon: '#23292F' },
    { name: 'Solana', symbol: 'SOL', icon: '#9945FF' },
    { name: 'Cardano', symbol: 'ADA', icon: '#0033AD' },
    { name: 'Dogecoin', symbol: 'DOGE', icon: '#C2A633' },
    { name: 'TRON', symbol: 'TRX', icon: '#FF060A' },
    { name: 'Polygon', symbol: 'MATIC', icon: '#8247E5' },
    { name: 'Avalanche', symbol: 'AVAX', icon: '#E84142' }
  ];

  const fetchCryptoData = async () => {
    setIsLoadingCoins(true);
    try {
      const symbols = Object.values(cryptoMapping);
      const response = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const dataArray = await response.json();
      const data = dataArray.reduce((acc: any, item: any) => {
        acc[item.symbol] = item;
        return acc;
      }, {});

      const updatedCoins = cryptoConfig.map((config) => {
        const binanceSymbol = cryptoMapping[config.symbol as keyof typeof cryptoMapping];
        const coinData = data[binanceSymbol];
        
        const price = coinData ? parseFloat(coinData.lastPrice) : 0;
        const change = coinData ? parseFloat(coinData.priceChangePercent) : 0;
        const volume = coinData ? parseFloat(coinData.volume) : 0;
        const quoteVolume = coinData ? parseFloat(coinData.quoteVolume) : 0;
        
        return {
          name: config.name,
          symbol: config.symbol,
          icon: config.icon,
          price: `$${price.toFixed(price < 1 ? 4 : 2)}`,
          changePercent: parseFloat(change.toFixed(2)),
          changeColor: change >= 0 ? 'green' as const : 'red' as const,
          volume: `${(volume / 1000).toFixed(0)}K`,
          marketCap: `$${(quoteVolume / 1000000).toFixed(1)}M`
        };
      });

      setCoinsList(updatedCoins);
    } catch (error) {
      console.error('Error fetching crypto data:', error);
    } finally {
      setIsLoadingCoins(false);
    }
  };

  const handleCoinSelect = (symbol: string) => {
    const coinData = coinsList.find(coin => coin.symbol === symbol);
    setSelectedCoin(symbol);
    setSelectedCoinData(coinData || null);
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/auth');
    }
  }, [user, isLoading, router]);

  useEffect(() => {
    fetchCryptoData();
    // Import component only on client side
    import('../../components/TradingChart').then((mod) => {
      setTradingChart(() => mod.default);
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
              <h1 className="text-xl font-bold text-white">Trading Center</h1>
              <p className="text-sm text-gray-400">
                {selectedCoin ? `Trading ${selectedCoin}/USDT` : 'Choose a cryptocurrency to start trading'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-400">Available Balance</p>
              <p className="text-xl font-bold text-green-400">$12,459.30</p>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6">
          {!selectedCoin ? (
            <>
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2 text-white">Select Cryptocurrency</h2>
                <p className="text-gray-400">Choose from our top 10 cryptocurrencies to start trading</p>
              </div>

              <div className="bg-gray-800 rounded-lg border border-gray-700">
                <div className="px-6 py-4 border-b border-gray-700">
                  <h3 className="text-lg font-semibold text-white">Available Cryptocurrencies</h3>
                </div>
                
                {isLoadingCoins ? (
                  <div className="p-8 text-center">
                    <div className="text-gray-400">Loading market data...</div>
                  </div>
                ) : (
                  <div className="overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-700">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Cryptocurrency
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Price
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            24h Change
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Volume
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Market Cap
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-gray-800 divide-y divide-gray-700">
                        {coinsList.map((coin, index) => (
                          <tr key={coin.symbol} className="hover:bg-gray-700 transition-colors cursor-pointer">
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <div 
                                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                                  style={{backgroundColor: coin.icon}}
                                >
                                  {coin.symbol.slice(0, 2)}
                                </div>
                                <div>
                                  <div className="text-sm font-medium text-white">{coin.symbol}</div>
                                  <div className="text-sm text-gray-400">{coin.name}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                              {coin.price}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`text-sm font-medium ${coin.changeColor === 'green' ? 'text-green-400' : 'text-red-400'}`}>
                                {coin.changeColor === 'green' ? '+' : ''}{coin.changePercent}%
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              {coin.volume}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                              {coin.marketCap}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <button 
                                onClick={() => handleCoinSelect(coin.symbol)}
                                className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                              >
                                Trade {coin.symbol}
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold mb-2 text-white">{selectedCoin}/USDT Trading</h2>
                  <p className="text-gray-400">Real-time trading interface</p>
                </div>
                <button
                  onClick={() => setSelectedCoin(null)}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  ← Back to Coin Selection
                </button>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                {/* Chart Section */}
                <div className="xl:col-span-3">
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
                    {TradingChart && selectedCoin ? (
                      <TradingChart 
                        backendBaseUrl="http://localhost:3001"
                        symbol={`${selectedCoin}USDT`}
                        interval="1m"
                      />
                    ) : (
                      <div className="w-full h-[520px] flex items-center justify-center">
                        <div className="text-gray-400">Loading chart...</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Trading Panel */}
                <div className="xl:col-span-1">
                  <TradingFormSimple 
                    selectedCoin={selectedCoin}
                    selectedCoinData={selectedCoinData}
                    onTradeSuccess={() => {
                      // Refresh data after successful trade
                      fetchCryptoData();
                    }}
                  />

                  {/* Market Info */}
                  <div className="bg-gray-800 rounded-lg border border-gray-700 p-4 mt-4">
                    <h4 className="text-sm font-medium text-gray-300 mb-3">Market Info</h4>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Current Price:</span>
                        <span className="text-white">{selectedCoinData?.price || '$--'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">24h Change:</span>
                        <span className={`${selectedCoinData?.changeColor === 'green' ? 'text-green-400' : 'text-red-400'}`}>
                          {selectedCoinData?.changePercent ? `${selectedCoinData.changeColor === 'green' ? '+' : ''}${selectedCoinData.changePercent}%` : '--'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">24h Volume:</span>
                        <span className="text-white">{selectedCoinData?.volume || '--'} {selectedCoin}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Market Cap:</span>
                        <span className="text-white">{selectedCoinData?.marketCap || '--'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
