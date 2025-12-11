'use client';

interface FavoriteItem {
  name: string;
  symbol: string;
  icon: string;
  price: string;
  changePercent: number;
  changeColor: 'green' | 'red';
}

interface FavoritesSectionProps {
  title: string;
  data: FavoriteItem[];
}

export default function FavoritesSection({ title, data }: FavoritesSectionProps) {
  return (
    <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700">
      <div className="px-6 py-4 border-b border-gray-700 flex justify-between items-center">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <button className="text-blue-400 hover:text-blue-300 text-sm font-medium">
          See All
        </button>
      </div>
      
      <div className="p-6">
        <div className="space-y-4">
          {data.map((item, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-700 transition-colors">
              <div className="flex items-center gap-3">
                <div 
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{backgroundColor: item.icon}}
                >
                  <span className="text-white font-bold text-sm">{item.symbol.slice(0, 2)}</span>
                </div>
                <div>
                  <div className="font-medium text-white">{item.symbol}</div>
                  <div className="text-sm text-gray-400">{item.name}</div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="font-bold text-white">{item.price}</div>
                <div className={`text-sm ${item.changeColor === 'green' ? 'text-green-400' : 'text-red-400'}`}>
                  {item.changeColor === 'green' ? '+' : '-'} {Math.abs(item.changePercent).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}