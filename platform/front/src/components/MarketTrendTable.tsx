'use client';

interface MarketTrendItem {
  name: string;
  symbol: string;
  icon: string;
  price: string;
  balance: number;
  value: string;
  changePercent: number;
  changeColor: 'green' | 'red';
}

interface MarketTrendTableProps {
  title: string;
  data: MarketTrendItem[];
  showActionButton?: boolean;
}

export default function MarketTrendTable({ title, data, showActionButton = false }: MarketTrendTableProps) {
  return (
    <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700">
      <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
          See All
        </button>
      </div>
      
      <div className="overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Price
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Balance
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Value
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Watchlist
              </th>
              {showActionButton && (
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Action
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {data.map((item, index) => (
              <tr key={index} className="hover:bg-gray-700 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{backgroundColor: item.icon}}
                    >
                      <span className="text-white font-bold text-xs">{item.symbol.slice(0, 2)}</span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-white">{item.symbol}</div>
                      <div className="text-sm text-gray-400">{item.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                  {item.price}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`text-sm ${item.changeColor === 'green' ? 'text-green-400' : 'text-red-400'}`}>
                    {item.changeColor === 'green' ? '+' : '-'} {Math.abs(item.changePercent).toLocaleString()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                  {item.value}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <button className="text-gray-400 hover:text-blue-400 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </button>
                </td>
                {showActionButton && (
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
                      Get Started
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}