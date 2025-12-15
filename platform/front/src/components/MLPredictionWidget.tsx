'use client';

import { useEffect, useState } from 'react';

interface MLIndicatorsProps {
  symbol: string;
  interval?: string;
}

interface MLFeatures {
  high: number;
  sma_20: number;
  sma_50: number;
  sma_200: number;
  bb_middle: number;
  bb_upper: number;
  bb_lower: number;
  volatility_10d: number;
  volatility_14d: number;
  macd_12_26: number;
  macd_5_35: number;
  macd_signal_5_35: number;
  below_all_sma: number;
}

interface FeaturesResponse {
  symbol: string;
  interval: string;
  timestamp: string;
  current_price: number;
  features: MLFeatures;
}

export default function MLPredictionWidget({ symbol, interval = '1h' }: MLIndicatorsProps) {
  const [features, setFeatures] = useState<FeaturesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `http://localhost:8000/api/analytics/ml-features/${symbol}?interval=${interval}`
        );

        if (!response.ok) throw new Error('Failed to fetch ML features');

        const data = await response.json();
        setFeatures(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchFeatures();
    const intervalId = setInterval(fetchFeatures, 60000);
    return () => clearInterval(intervalId);
  }, [symbol, interval]);

  if (loading && !features) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 animate-pulse">
        <div className="h-4 bg-gray-700 rounded w-3/4 mb-4"></div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-3 bg-gray-700 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || !features) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
        <p className="text-red-500 text-sm">Error: {error || 'No data'}</p>
      </div>
    );
  }

  const { features: f, current_price } = features;

  // Calculate signals
  const trendSignal = f.below_all_sma === 1 ? 'Bearish' : 'Bullish';
  const macdSignal = f.macd_5_35 > f.macd_signal_5_35 ? 'Buy' : 'Sell';
  const bbPosition = current_price > f.bb_upper ? 'Overbought' :
                     current_price < f.bb_lower ? 'Oversold' : 'Neutral';

  return (
    <div className="bg-gray-800 rounded-lg p-6 space-y-4">
      {/* Header */}
      <div className="border-b border-gray-700 pb-3">
        <h3 className="text-lg font-bold text-white">{symbol} ML Indicators</h3>
        <p className="text-gray-400 text-xs mt-1">{interval} • Updated {new Date().toLocaleTimeString()}</p>
      </div>

      {/* Current Price */}
      <div className="bg-blue-900/30 border border-blue-500 rounded-lg p-3">
        <div className="text-xs text-gray-400">Current Price</div>
        <div className="text-2xl font-bold text-white mt-1">
          ${current_price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
        </div>
      </div>

      {/* Signals */}
      <div className="grid grid-cols-3 gap-2">
        <SignalBadge label="Trend" value={trendSignal} color={trendSignal === 'Bullish' ? 'green' : 'red'} />
        <SignalBadge label="MACD" value={macdSignal} color={macdSignal === 'Buy' ? 'green' : 'red'} />
        <SignalBadge label="BB" value={bbPosition} color={bbPosition === 'Overbought' ? 'red' : bbPosition === 'Oversold' ? 'green' : 'yellow'} />
      </div>

      {/* Bollinger Bands */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-300 uppercase">Bollinger Bands</h4>
        <div className="space-y-1">
          <ValueRow label="Upper" value={f.bb_upper} type="price" />
          <ValueRow label="Middle" value={f.bb_middle} type="price" />
          <ValueRow label="Lower" value={f.bb_lower} type="price" isNew />
        </div>
      </div>

      {/* Moving Averages */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-300 uppercase">Moving Averages</h4>
        <div className="space-y-1">
          <ValueRow label="SMA 20" value={f.sma_20} type="price" current={current_price} />
          <ValueRow label="SMA 50" value={f.sma_50} type="price" current={current_price} />
          <ValueRow label="SMA 200" value={f.sma_200} type="price" current={current_price} />
        </div>
      </div>

      {/* Volatility */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-300 uppercase">Volatility</h4>
        <div className="space-y-1">
          <ValueRow label="10 Day" value={f.volatility_10d * 100} type="percent" />
          <ValueRow label="14 Day" value={f.volatility_14d * 100} type="percent" />
        </div>
      </div>

      {/* ML Ready Badge */}
      <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500 rounded-lg p-3 mt-4">
        <div className="flex items-center gap-2">
          <div className="text-xl">🤖</div>
          <div>
            <div className="text-xs font-semibold text-purple-300">ML Model Ready</div>
            <div className="text-xs text-gray-400">All 12 features available</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SignalBadge({ label, value, color }: { label: string; value: string; color: 'green' | 'red' | 'yellow' }) {
  const colorClasses = {
    green: 'bg-green-900/30 border-green-500 text-green-400',
    red: 'bg-red-900/30 border-red-500 text-red-400',
    yellow: 'bg-yellow-900/30 border-yellow-500 text-yellow-400',
  };

  return (
    <div className={`${colorClasses[color]} border rounded-lg p-2 text-center`}>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-sm font-bold mt-1">{value}</div>
    </div>
  );
}

function ValueRow({
  label,
  value,
  type = 'number',
  current,
  isNew = false
}: {
  label: string;
  value: number;
  type?: 'price' | 'percent' | 'number';
  current?: number;
  isNew?: boolean;
}) {
  let displayValue = '';
  let color = 'text-white';

  if (type === 'price') {
    displayValue = `$${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
    if (current) {
      color = current > value ? 'text-green-400' : 'text-red-400';
    }
  } else if (type === 'percent') {
    displayValue = `${value.toFixed(2)}%`;
  } else {
    displayValue = value.toFixed(2);
  }

  return (
    <div className="flex justify-between items-center bg-gray-900 rounded px-3 py-2">
      <span className="text-xs text-gray-400 flex items-center gap-2">
        {label}
        {isNew && <span className="text-xs bg-blue-500 text-white px-1 rounded">NEW</span>}
      </span>
      <span className={`text-xs font-mono font-semibold ${color}`}>{displayValue}</span>
    </div>
  );
}
