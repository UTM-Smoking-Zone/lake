'use client';

import { useEffect, useState } from 'react';
// import { useAuth } from '@/contexts/AuthContext';
// import { useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import CryptoPortfolioCard from '@/components/CryptoPortfolioCard';
import MarketTrendTable from '@/components/MarketTrendTable';
import FavoritesSection from '@/components/FavoritesSection';

// Interface definitions
interface PortfolioCardData {
  name: string;
  symbol: string;
  icon: string;
  currentPrice: string;
  changePercent: number;
  changeColor: 'green' | 'red';
  miniChartData: number[];
}

interface MarketTrendData {
  name: string;
  symbol: string;
  icon: string;
  price: string;
  balance: number;
  value: string;
  changePercent: number;
  changeColor: 'green' | 'red';
}

interface FavoriteData {
  name: string;
  symbol: string;
  icon: string;
  price: string;
  changePercent: number;
  changeColor: 'green' | 'red';
}

export default function DashboardPage() {
  // const { user, isLoading } = useAuth();
  // const router = useRouter();
  const [BtcCandles, setBtcCandles] = useState<any>(null);
  const [portfolioCards, setPortfolioCards] = useState<PortfolioCardData[]>([]);
  const [marketTrendData, setMarketTrendData] = useState<MarketTrendData[]>([]);
  const [favoritesData, setFavoritesData] = useState<FavoriteData[]>([]);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
  const [fetchCounter, setFetchCounter] = useState<number>(0);

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
    setFetchCounter(prev => prev + 1);
    try {
      console.log('Fetching crypto data from Binance...');
      const symbols = Object.values(cryptoMapping);
      const response = await fetch(
        `https://api.binance.com/api/v3/ticker/24hr?symbols=${encodeURIComponent(JSON.stringify(symbols))}`
      );
      
      if (!response.ok) {
        console.error('Binance API response not ok:', response.status);
        return;
      }
      
      const dataArray = await response.json();
      // Convert array to object for easier access
      const data = dataArray.reduce((acc: any, item: any) => {
        acc[item.symbol] = item;
        return acc;
      }, {});
      console.log('Fetched crypto data from Binance:', data);

      const updatedPortfolioCards = cryptoConfig.map((config) => {
        const binanceSymbol = cryptoMapping[config.symbol as keyof typeof cryptoMapping];
        const coinData = data[binanceSymbol];
        
        // Use real Binance data
        const price = coinData ? parseFloat(coinData.lastPrice) : 0;
        const change = coinData ? parseFloat(coinData.priceChangePercent) : 0;
        
        return {
          name: config.name,
          symbol: config.symbol,
          icon: config.icon,
          currentPrice: `$${price.toFixed(price < 1 ? 4 : 2)}`,
          changePercent: parseFloat(Math.abs(change).toFixed(2)),
          changeColor: change >= 0 ? 'green' as const : 'red' as const,
          miniChartData: [100, 120, 110, 140, 130, 150, 145] // Static for now
        };
      });

      const updatedMarketData = cryptoConfig.map((config) => {
        const binanceSymbol = cryptoMapping[config.symbol as keyof typeof cryptoMapping];
        const coinData = data[binanceSymbol];
        
        // Use real Binance data
        const price = coinData ? parseFloat(coinData.lastPrice) : 0;
        const change = coinData ? parseFloat(coinData.priceChangePercent) : 0;
        
        return {
          name: config.name,
          symbol: config.symbol,
          icon: config.icon,
          price: `$${price.toFixed(price < 1 ? 4 : 2)}`,
          balance: 201.01,
          value: `$${(price * 201.01).toFixed(2)}`,
          changePercent: parseFloat(Math.abs(change).toFixed(2)),
          changeColor: change >= 0 ? 'green' as const : 'red' as const
        };
      });

      const updatedFavorites = cryptoConfig.slice(0, 5).map((config) => {
        const binanceSymbol = cryptoMapping[config.symbol as keyof typeof cryptoMapping];
        const coinData = data[binanceSymbol];
        
        // Use real Binance data
        const price = coinData ? parseFloat(coinData.lastPrice) : 0;
        const change = coinData ? parseFloat(coinData.priceChangePercent) : 0;
        
        return {
          name: config.name,
          symbol: config.symbol,
          icon: config.icon,
          price: `$${price.toFixed(price < 1 ? 4 : 2)}`,
          changePercent: parseFloat(Math.abs(change).toFixed(2)),
          changeColor: change >= 0 ? 'green' as const : 'red' as const
        };
      });

      console.log('✅ Setting portfolio cards:', updatedPortfolioCards.length, 'items');
      console.log('✅ Setting market data:', updatedMarketData.length, 'items');
      console.log('✅ Setting favorites:', updatedFavorites.length, 'items');
      
      setPortfolioCards(updatedPortfolioCards);
      setMarketTrendData(updatedMarketData);
      setFavoritesData(updatedFavorites);
      setLastUpdate(new Date());
      
      console.log('✨ Data update completed at:', new Date().toLocaleTimeString());

    } catch (error) {
      console.error('Error fetching crypto data:', error);
    }
  };

  // useEffect(() => {
  //   if (!isLoading && !user) {
  //     router.push('/auth');
  //   }
  // }, [user, isLoading, router]);

  useEffect(() => {
    // Import component only on client side
    import('../../components/BtcCandles').then((mod) => {
      setBtcCandles(() => mod.default);
    });
  }, []);

  useEffect(() => {
    console.log('🚀 Starting crypto data fetching...');
    // Initial fetch
    fetchCryptoData();
    
    // Set up interval for auto-refresh every 3 seconds
    const interval = setInterval(() => {
      console.log('⏰ Auto-refresh triggered at:', new Date().toLocaleTimeString());
      fetchCryptoData();
    }, 3000);
    
    // Cleanup interval on component unmount
    return () => {
      console.log('🧹 Cleanup interval');
      clearInterval(interval);
    };
  }, []);

  // Sample crypto data - Top 10 most popular cryptocurrencies (now replaced by real data)

  // if (isLoading) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-gray-900">
  //       <div className="text-white text-xl">Loading...</div>
  //     </div>
  //   );
  // }

  // if (!user) {
  //   return null;
  // }

  return (
    <div className="flex min-h-screen bg-gray-900">
      <Sidebar />
      
      <div className="flex-1">
        <main className="p-6 space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">My Portfolio</h1>
            <p className="text-sm text-gray-400">
              Last updated: {lastUpdate.toLocaleTimeString()} | Auto-refresh: every 3 seconds | Fetch count: {fetchCounter}
            </p>
          </div>

          {/* Portfolio Cards */}
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
              {portfolioCards.slice(0, 5).map((card, index) => (
                <CryptoPortfolioCard
                  key={index}
                  name={card.name}
                  symbol={card.symbol}
                  icon={card.icon}
                  currentPrice={card.currentPrice}
                  changePercent={card.changePercent}
                  changeColor={card.changeColor}
                  miniChartData={card.miniChartData}
                />
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {portfolioCards.slice(5, 10).map((card, index) => (
                <CryptoPortfolioCard
                  key={index + 5}
                  name={card.name}
                  symbol={card.symbol}
                  icon={card.icon}
                  currentPrice={card.currentPrice}
                  changePercent={card.changePercent}
                  changeColor={card.changeColor}
                  miniChartData={card.miniChartData}
                />
              ))}
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Bitcoin Chart - Main */}
            <div className="lg:col-span-2">
              <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700">
                <div className="p-6 border-b border-gray-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <h2 className="text-xl font-bold text-white mb-1">Bitcoin</h2>
                      <p className="text-gray-400">BTC-USDT</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-400">Last update 1h:40</p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6">
                  {BtcCandles ? (
                    <BtcCandles backendBaseUrl="http://localhost:3001" />
                  ) : (
                    <div className="w-full h-[400px] flex items-center justify-center">
                      <div className="text-gray-400">Loading Bitcoin chart...</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Sidebar */}
            <div className="space-y-6">
              <FavoritesSection
                title="My Favorite"
                data={favoritesData}
              />
            </div>
          </div>

          {/* Market Trend Table */}
          <MarketTrendTable
            title="Market Trend"
            data={marketTrendData}
            showActionButton={true}
          />
        </main>
      </div>
    </div>
  );
}
