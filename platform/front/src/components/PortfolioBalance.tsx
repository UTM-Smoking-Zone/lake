'use client';

import { useEffect, useState } from 'react';

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

interface PortfolioBalanceProps {
  className?: string;
  textSize?: string;
}

export default function PortfolioBalance({ className = "text-xl font-bold text-green-400", textSize }: PortfolioBalanceProps) {
  const [totalValue, setTotalValue] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // API endpoints
  const PORTFOLIO_API = 'http://localhost:8001';
  const USER_ID = '4'; // Known user ID from database

  useEffect(() => {
    fetchPortfolioAndCalculateValue();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchPortfolioAndCalculateValue, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchPortfolioAndCalculateValue = async () => {
    try {
      setIsLoading(true);
      
      // Fetch portfolio data
      const portfolioResponse = await fetch(`${PORTFOLIO_API}/portfolio/${USER_ID}`, {
        headers: {
          'x-user-id': USER_ID
        }
      });
      
      if (!portfolioResponse.ok) {
        throw new Error('Failed to fetch portfolio');
      }
      
      const portfolios = await portfolioResponse.json();
      if (portfolios.length === 0) {
        setTotalValue(0);
        return;
      }
      
      const portfolio: Portfolio = portfolios[0];
      
      // Fetch crypto prices
      const symbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'XRPUSDT', 'SOLUSDT', 'ADAUSDT', 'DOGEUSDT', 'TRXUSDT', 'MATICUSDT', 'AVAXUSDT'];
      const pricesPromises = symbols.map(async (symbol) => {
        const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
        const data = await response.json();
        return { symbol, price: parseFloat(data.price) };
      });
      
      const pricesData = await Promise.all(pricesPromises);
      const cryptoPrices: Record<string, number> = {};
      
      pricesData.forEach(({ symbol, price }) => {
        const coinCode = symbol.replace('USDT', '');
        cryptoPrices[coinCode] = price;
      });
      
      // Add stablecoins at $1
      cryptoPrices['USDT'] = 1;
      cryptoPrices['USDC'] = 1;
      cryptoPrices['USD'] = 1;
      
      // Calculate total value
      let total = 0;
      portfolio.balances.forEach(balance => {
        const price = cryptoPrices[balance.asset_code] || 0;
        const quantity = parseFloat(balance.qty);
        total += price * quantity;
      });
      
      setTotalValue(total);
      
    } catch (error) {
      console.error('Failed to fetch portfolio balance:', error);
      setTotalValue(0);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <span className={className}>Loading...</span>;
  }

  return (
    <span className={textSize ? `${textSize} font-bold text-green-400` : className}>
      ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}