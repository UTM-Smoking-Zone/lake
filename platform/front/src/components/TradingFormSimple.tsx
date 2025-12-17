'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Notification from './Notification';

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
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [type, setType] = useState<'market' | 'limit'>('market');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPredicting, setIsPredicting] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cryptoPrices, setCryptoPrices] = useState<Record<string, number>>({});
  const [totalValue, setTotalValue] = useState(0);
  const [notification, setNotification] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
    isVisible: boolean;
  }>({
    message: '',
    type: 'info',
    isVisible: false,
  });

  // Temporary direct API access for testing (bypass API Gateway auth)
  const PORTFOLIO_API = 'http://localhost:8001';
  const ORDER_API = 'http://localhost:8002';
  const TRANSACTION_API = 'http://localhost:8003';
  const ML_SERVICE_API = 'http://localhost:8005';
  const ML_PREDICTION_API = 'http://localhost:8007';

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({
      message,
      type,
      isVisible: true,
    });
  };

  const hideNotification = () => {
    setNotification(prev => ({
      ...prev,
      isVisible: false,
    }));
  };

  const predictWithML = async () => {
    if (!selectedCoin || isPredicting) return;
    
    // Convert BTC to BTCUSDT for API call
    const tradingSymbol = selectedCoin === 'BTC' ? 'BTCUSDT' : selectedCoin;
    
    setIsPredicting(true);
    try {
      // Call ML Service for price prediction
      const mlResponse = await fetch(`${ML_SERVICE_API}/predict?symbol=${tradingSymbol}&horizon=24&interval=1h`);
      const mlData = await mlResponse.json();

      if (mlResponse.ok) {
        const { current_price, predicted_price, prediction_change_pct, confidence } = mlData;
        
        let recommendation = '';
        let actionType: 'success' | 'error' | 'info' = 'info';
        
        const changePercent = parseFloat(prediction_change_pct);
        
        if (changePercent > 2) {
          recommendation = `🚀 CUMPĂRĂ! Prețul Bitcoin se prevede să crească cu ${prediction_change_pct}% (de la $${current_price.toFixed(2)} la $${predicted_price.toFixed(2)}). Încredere: ${(confidence * 100).toFixed(1)}%`;
          actionType = 'success';
        } else if (changePercent < -2) {
          recommendation = `📉 NU CUMPĂRA! Prețul Bitcoin se prevede să scadă cu ${Math.abs(changePercent)}% (de la $${current_price.toFixed(2)} la $${predicted_price.toFixed(2)}). Încredere: ${(confidence * 100).toFixed(1)}%`;
          actionType = 'error';
        } else {
          recommendation = `⚖️ NEUTRU! Prețul Bitcoin rămâne relativ stabil (schimbare ${prediction_change_pct}%). Preț actual: $${current_price.toFixed(2)}, previzionat: $${predicted_price.toFixed(2)}. Încredere: ${(confidence * 100).toFixed(1)}%`;
          actionType = 'info';
        }
        
        showNotification(recommendation, actionType);
      } else {
        showNotification('❌ Eroare la predicția prețului. Serviciul ML nu este disponibil.', 'error');
      }
    } catch (error) {
      console.error('ML Prediction error:', error);
      showNotification('❌ Nu se poate conecta la serviciul ML de predicție.', 'error');
    } finally {
      setIsPredicting(false);
    }
  };

  useEffect(() => {
    fetchPortfolio();
    fetchOrders();
    fetchCryptoPrices();
    
    // Refresh prices every 30 seconds
    const priceInterval = setInterval(fetchCryptoPrices, 30000);
    return () => clearInterval(priceInterval);
  }, []);

  useEffect(() => {
    // Recalculate total value when portfolio or prices change
    if (portfolio && Object.keys(cryptoPrices).length > 0) {
      calculateTotalValue();
    }
  }, [portfolio, cryptoPrices]);

  useEffect(() => {
    // Auto-calculate based on buy/sell logic
    if (side === 'buy') {
      // BUY: Amount (USDT) -> Quantity (Crypto)
      if (amount && selectedCoinData?.price) {
        const currentPrice = parseFloat(selectedCoinData.price.replace('$', '').replace(',', ''));
        const calculatedQuantity = parseFloat(amount) / currentPrice;
        setQuantity(calculatedQuantity.toFixed(8));
      }
    } else {
      // SELL: Amount (Crypto) -> Quantity (USDT) 
      if (amount && selectedCoinData?.price) {
        const currentPrice = parseFloat(selectedCoinData.price.replace('$', '').replace(',', ''));
        const calculatedQuantity = parseFloat(amount) * currentPrice;
        setQuantity(calculatedQuantity.toFixed(2));
      }
    }
  }, [amount, selectedCoinData, side]);

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

  const fetchPortfolio = async () => {
    if (!user?.id) return;
    
    try {
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
    }
  };

  const fetchOrders = async () => {
    if (!user?.id) return;
    
    try {
      if (!portfolio?.id) {
        // Use hardcoded portfolio id for testing
        const response = await fetch(`${ORDER_API}/orders/3`, {
          headers: {
            'x-user-id': user.id
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
    if (!amount || !user?.id) return;

    setIsLoading(true);
    try {
      // Create order - pentru sell folosim amount (crypto quantity), pentru buy folosim quantity (crypto quantity)
      const orderQuantity = side === 'sell' ? parseFloat(amount) : parseFloat(quantity);
      
      const orderData = {
        portfolio_id: portfolio?.id || '4', // Use actual portfolio ID, fallback to known ID
        symbol: `${selectedCoin}USDT`,
        type: type,
        side: side,
        quantity: orderQuantity,
        price: type === 'limit' ? parseFloat(price) : undefined,
        exchange_code: 'BINANCE'
      };

      const createResponse = await fetch(`${ORDER_API}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id
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
            'x-user-id': user.id
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
        showNotification(
          `✅ Trade executed successfully!\n${execution.side.toUpperCase()} ${execution.quantity} ${selectedCoin} at $${execution.fill_price.toLocaleString()}`,
          'success'
        );
      } else {
        showNotification(
          `✅ Limit order placed successfully!\nOrder ID: ${order.id}`,
          'success'
        );
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
      showNotification(`❌ Trading failed: ${error}`, 'error');
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
    if (side === 'buy') {
      // For BUY: set max USDT amount
      const usdtBalance = parseFloat(portfolio?.balances?.find(b => b.asset_code === 'USDT')?.qty || '0');
      if (usdtBalance > 0) {
        setAmount(usdtBalance.toFixed(2));
      }
    } else {
      // For SELL: set max crypto amount
      const coinBalance = parseFloat(portfolio?.balances?.find(b => b.asset_code === selectedCoin)?.qty || '0');
      if (coinBalance > 0) {
        setAmount(coinBalance.toFixed(8));
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Trading Form */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Trade {selectedCoin}</h3>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Buy/Sell Toggle */}
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              type="button"
              onClick={() => {
                setSide('buy');
                setAmount('');
                setQuantity('');
              }}
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
              onClick={() => {
                setSide('sell');
                setAmount('');
                setQuantity('');
              }}
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
            disabled={isLoading || !amount}
            className={`w-full font-medium py-3 rounded-lg transition-colors ${
              side === 'buy'
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white'
            } ${(isLoading || !amount) ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {isLoading ? 'Processing...' : `${side.charAt(0).toUpperCase() + side.slice(1)} ${selectedCoin}`}
          </button>

          {/* ML Prediction Button */}
          {(selectedCoin === 'BTCUSDT' || selectedCoin === 'BTC') && (
            <button 
              type="button"
              onClick={predictWithML}
              disabled={isPredicting}
              className={`w-full font-medium py-3 rounded-lg transition-colors bg-purple-600 hover:bg-purple-500 text-white mt-3 ${
                isPredicting ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {isPredicting ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Analizez cu AI...
                </span>
              ) : (
                <span className="flex items-center justify-center">
                  🤖 Predicție ML pentru Bitcoin
                </span>
              )}
            </button>
          )}

          {/* Balance Info */}
          <div className="text-xs text-gray-400 mt-4 space-y-1">
            <div className="flex justify-between">
              <span>Available:</span>
              <span>{getAvailableBalance()} {side === 'buy' ? 'USDT' : selectedCoin}</span>
            </div>
            <div className="flex justify-between">
              <span>Est. Fee (0.1%):</span>
              <span>
                {side === 'buy' 
                  ? `~${(parseFloat(amount || '0') * 0.001).toFixed(2)} USDT`
                  : `~${(parseFloat(quantity || '0') * 0.001).toFixed(2)} USDT`
                }
              </span>
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

      {/* Notification */}
      <Notification
        message={notification.message}
        type={notification.type}
        isVisible={notification.isVisible}
        onClose={hideNotification}
        autoHide={!isPredicting} // Keep ML predictions visible longer
      />
    </div>
  );
}