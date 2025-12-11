'use client';

interface CryptoPortfolioCardProps {
  name: string;
  symbol: string;
  icon: string;
  totalShares: number;
  totalReturn: string;
  changePercent: number;
  changeColor: 'green' | 'red';
  miniChartData: number[];
}

export default function CryptoPortfolioCard({ 
  name, 
  symbol, 
  icon,
  totalShares, 
  totalReturn, 
  changePercent, 
  changeColor,
  miniChartData 
}: CryptoPortfolioCardProps) {
  // Simple SVG mini chart
  const renderMiniChart = () => {
    const max = Math.max(...miniChartData);
    const min = Math.min(...miniChartData);
    const range = max - min;
    
    if (range === 0) return null;
    
    const pathData = miniChartData
      .map((value, index) => {
        const x = (index / (miniChartData.length - 1)) * 60;
        const y = 20 - ((value - min) / range) * 20;
        return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
      })
      .join(' ');

    return (
      <svg width="60" height="20" className="overflow-visible">
        <path
          d={pathData}
          fill="none"
          stroke={changeColor === 'green' ? '#10B981' : '#EF4444'}
          strokeWidth="1.5"
        />
      </svg>
    );
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{backgroundColor: icon}}>
            <span className="text-white font-bold text-sm">{symbol.slice(0, 2)}</span>
          </div>
          <span className="font-medium text-white">{name}</span>
        </div>
        <div className="text-right">
          {renderMiniChart()}
        </div>
      </div>
      
      <div className="space-y-1">
        <div className="flex justify-between items-center text-sm text-gray-400">
          <span>Total Shares</span>
          <span className="text-gray-200 font-medium">
            {changeColor === 'green' ? '+' : '-'} {totalShares.toLocaleString()}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Total Return</span>
          <div className="text-right">
            <div className="font-bold text-white">{totalReturn}</div>
            <div className={`text-sm ${changeColor === 'green' ? 'text-green-400' : 'text-red-400'}`}>
              {changeColor === 'green' ? '+' : '-'} {Math.abs(changePercent).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}