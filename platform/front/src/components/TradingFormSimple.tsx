'use client';

import { useState, useEffect } from 'react';

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

interface Order {
  id: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit';
  price: string;
  quantity: string;
  status: string;
  created_ts: string;
  symbol: string;
  exchange: string;
}

interface TradingFormProps {
  selectedCoin: string;
  selectedCoinData: any;
  onTradeSuccess: () => void;
}

export default function TradingFormSimple({ selectedCoin, selectedCoinData, onTradeSuccess }: TradingFormProps) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [type, setType] = useState<'market' | 'limit'>('market');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);

  // Temporary direct API access for testing (bypass API Gateway auth)
  const PORTFOLIO_API = 'http://localhost:8001';
  const ORDER_API = 'http://localhost:8002';
  const TRANSACTION_API = 'http://localhost:8003';
  const TEST_USER_ID = '1';

  useEffect(() => {
    fetchPortfolio();
    fetchOrders();
  }, []);

  useEffect(() => {
    // Auto-calculate quantity when amount changes
    if (amount && selectedCoinData?.price && side === 'buy') {
      const currentPrice = parseFloat(selectedCoinData.price.replace('$', '').replace(',', ''));
      const calculatedQuantity = parseFloat(amount) / currentPrice;
      setQuantity(calculatedQuantity.toFixed(8));
    }
    // Auto-calculate amount when quantity changes
    else if (quantity && selectedCoinData?.price) {
      const currentPrice = parseFloat(selectedCoinData.price.replace('$', '').replace(',', ''));
      const calculatedAmount = parseFloat(quantity) * currentPrice;
      setAmount(calculatedAmount.toFixed(2));
    }
  }, [amount, quantity, selectedCoinData, side]);

  const fetchPortfolio = async () => {
    try {
      const response = await fetch(`${PORTFOLIO_API}/portfolio/${TEST_USER_ID}`, {
        headers: {
          'x-user-id': TEST_USER_ID
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
    }
  };

  const fetchOrders = async () => {
    try {
      if (!portfolio?.id) {
        // Use hardcoded portfolio id for testing
        const response = await fetch(`${ORDER_API}/orders/1`, {
          headers: {
            'x-user-id': TEST_USER_ID
          }
        });
        if (response.ok) {
          const ordersData = await response.json();
          setOrders(ordersData);
        }
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quantity) return;

    setIsLoading(true);
    try {
      // Create order
      const orderData = {
        portfolio_id: 1, // Hardcoded for testing
        symbol: `${selectedCoin}USDT`,
        type: type,
        side: side,
        quantity: parseFloat(quantity),
        price: type === 'limit' ? parseFloat(price) : undefined,
        exchange_code: 'BINANCE'
      };

      const createResponse = await fetch(`${ORDER_API}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': TEST_USER_ID
        },
        body: JSON.stringify(orderData)
      });

      if (!createResponse.ok) {
        const error = await createResponse.json();
        throw new Error(error.error || 'Failed to create order');
      }

      const order = await createResponse.json();

      // Execute market orders immediately
      if (type === 'market') {
        const currentPrice = parseFloat(selectedCoinData?.price?.replace('$', '').replace(',', '') || '0');
        const executeResponse = await fetch(`${ORDER_API}/orders/${order.id}/execute`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': TEST_USER_ID
          },
          body: JSON.stringify({
            execution_price: currentPrice
          })
        });

        if (!executeResponse.ok) {
          const error = await executeResponse.json();
          throw new Error(error.error || 'Failed to execute order');
        }

        const execution = await executeResponse.json();
        alert(`✅ Trade executed successfully!\\n${execution.side.toUpperCase()} ${execution.quantity} ${selectedCoin} at $${execution.fill_price.toLocaleString()}`);
      } else {
        alert(`✅ Limit order placed successfully!\\nOrder ID: ${order.id}`);
      }

      // Reset form
      setQuantity('');
      setAmount('');
      setPrice('');
      
      // Refresh data
      fetchPortfolio();
      fetchOrders();
      onTradeSuccess();

    } catch (error) {
      console.error('Trading error:', error);
      alert(`❌ Trading failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getAvailableBalance = () => {
    if (!portfolio) return '0';
    
    if (side === 'buy') {
      // For buying, show USDT balance
      const usdtBalance = portfolio.balances.find(b => b.asset_code === 'USDT');
      return parseFloat(usdtBalance?.qty || '0').toFixed(2);
    } else {
      // For selling, show selected coin balance
      const coinBalance = portfolio.balances.find(b => b.asset_code === selectedCoin);
      return parseFloat(coinBalance?.qty || '0').toFixed(8);
    }
  };

  const getMaxQuantity = () => {
    if (!portfolio || !selectedCoinData) return 0;
    
    if (side === 'buy') {
      const usdtBalance = parseFloat(portfolio.balances.find(b => b.asset_code === 'USDT')?.qty || '0');
      const currentPrice = parseFloat(selectedCoinData.price.replace('$', '').replace(',', ''));
      return usdtBalance / currentPrice;
    } else {
      const coinBalance = parseFloat(portfolio.balances.find(b => b.asset_code === selectedCoin)?.qty || '0');
      return coinBalance;
    }
  };

  const setMaxAmount = () => {
    const maxQty = getMaxQuantity();
    if (maxQty > 0) {
      setQuantity(maxQty.toFixed(8));
    }
  };

  return (
    <div className="space-y-6">
      {/* Debug Info */}
      <div className="bg-gray-900 rounded-lg border border-gray-600 p-3">
        <h4 className="text-xs font-medium text-gray-300 mb-2">Debug Info</h4>
        <div className="text-xs text-gray-400 space-y-1">
          <div>Portfolio ID: {portfolio?.id || 'Loading...'}</div>
          <div>USDT Balance: {portfolio?.balances?.find(b => b.asset_code === 'USDT')?.qty || 'N/A'}</div>
          <div>BTC Balance: {portfolio?.balances?.find(b => b.asset_code === 'BTC')?.qty || 'N/A'}</div>
        </div>
      </div>

      {/* Trading Form */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Trade {selectedCoin}</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Buy/Sell Toggle */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setSide('buy')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${ 
                side === 'buy' 
                  ? 'bg-green-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setSide('sell')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                side === 'sell' 
                  ? 'bg-red-600 text-white' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sell
            </button>
          </div>

          {/* Order Type */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Order Type</label>
            <select 
              value={type}
              onChange={(e) => setType(e.target.value as 'market' | 'limit')}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
            >
              <option value="market">Market</option>
              <option value="limit">Limit</option>
            </select>
          </div>

          {/* Price (only for limit orders) */}
          {type === 'limit' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Price (USDT)</label>
              <input 
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={selectedCoinData?.price?.replace('$', '') || '0.00'}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
                required
              />
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Amount ({side === 'buy' ? 'USDT' : selectedCoin})
            </label>
            <div className="relative">
              <input 
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white pr-12"
              />
              <button
                type="button"
                onClick={setMaxAmount}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs bg-blue-600 hover:bg-blue-500 px-2 py-1 rounded text-white"
              >
                MAX
              </button>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Quantity ({side === 'buy' ? selectedCoin : 'USDT'})
            </label>
            <input 
              type="number"
              step="0.00000001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0.00000000"
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              required
            />
          </div>

          {/* Submit Button */}
          <button 
            type="submit"
            disabled={isLoading || !quantity}
            className={`w-full font-medium py-3 rounded-lg transition-colors ${
              side === 'buy'
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white'
            } ${(isLoading || !quantity) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? 'Processing...' : `${side.charAt(0).toUpperCase() + side.slice(1)} ${selectedCoin}`}
          </button>

          {/* Balance Info */}
          <div className="text-xs text-gray-400 mt-4 space-y-1">
            <div className="flex justify-between">
              <span>Available:</span>
              <span>{getAvailableBalance()} {side === 'buy' ? 'USDT' : selectedCoin}</span>
            </div>
            <div className="flex justify-between">
              <span>Est. Fee (0.1%):</span>
              <span>~{(parseFloat(amount || '0') * 0.001).toFixed(2)} {side === 'buy' ? 'USDT' : selectedCoin}</span>
            </div>
          </div>
        </form>
      </div>

      {/* Recent Orders */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Recent Orders</h4>
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {orders.slice(0, 5).map((order) => (
            <div key={order.id} className="flex justify-between items-center text-xs">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  order.side === 'buy' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                }`}>
                  {order.side.toUpperCase()}
                </span>
                <span className="text-white">{order.symbol}</span>
              </div>
              <div className="text-right">
                <div className="text-white">{parseFloat(order.quantity).toFixed(4)}</div>
                <div className={`text-xs ${
                  order.status === 'filled' ? 'text-green-400' : 
                  order.status === 'open' ? 'text-yellow-400' : 'text-gray-400'
                }`}>
                  {order.status}
                </div>
              </div>
            </div>
          ))}
          {orders.length === 0 && (
            <div className="text-gray-500 text-center py-2">No recent orders</div>
          )}
        </div>
      </div>
    </div>
  );
}