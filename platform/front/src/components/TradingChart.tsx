"use client";

import { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData } from "lightweight-charts";
import { io } from "socket.io-client";

type Props = {
  backendBaseUrl: string;
  symbol?: string;   // e.g., BTCUSDT, ETHUSDT, etc.
  interval?: string; // e.g., 1m, 5m, 15m, 1h
};

export default function TradingChart({ backendBaseUrl, symbol = "BTCUSDT", interval = "1m" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Init chart + load history + connect socket
  useEffect(() => {
    if (!containerRef.current) {
      console.error("❌ Container ref is null");
      return;
    }

    console.log(`📊 Creating chart for ${symbol}...`);
    const chart = createChart(containerRef.current, {
      height: 520,
      layout: { 
        background: { color: "#0b0f14" }, 
        textColor: "#e6e9ef" 
      },
      grid: { 
        vertLines: { color: "#1c252f" }, 
        horzLines: { color: "#1c252f" } 
      },
      rightPriceScale: {
        borderColor: "#1c252f",
      },
      timeScale: {
        borderColor: "#1c252f",
        timeVisible: true,
        secondsVisible: false,
      },
    });
    
    const series = chart.addCandlestickSeries({
      upColor: '#4ade80',
      downColor: '#ef4444',
      borderUpColor: '#4ade80',
      borderDownColor: '#ef4444',
      wickUpColor: '#4ade80',
      wickDownColor: '#ef4444',
    });
    
    console.log(`✅ Chart created for ${symbol}`);

    chartRef.current = chart;
    seriesRef.current = series;

    // 1) Load historical data
    console.log("📊 Fetching candles from", `${backendBaseUrl}/candles`);
    fetch(`${backendBaseUrl}/candles?symbol=${symbol}&interval=${interval}&limit=500`)
      .then(r => r.json())
      .then((rows: CandlestickData[]) => {
        console.log(`✅ Loaded ${rows.length} candles for ${symbol}`);
        series.setData(rows);
        chart.timeScale().fitContent();
      })
      .catch((err) => {
        console.error(`❌ Error fetching candles for ${symbol}:`, err);
      });

    // 2) Live updates via Socket.IO
    console.log("🔌 Connecting to Socket.IO:", `${backendBaseUrl}/market`);
    const socket = io(`${backendBaseUrl}/market`, {
      transports: ["polling", "websocket"],
    });

    socket.on("connect", () => {
      console.log(`✅ Socket.IO connected to ${backendBaseUrl}/market for ${symbol}`);
    });

    socket.on("kline", (k: any) => {
      // Only process events for our symbol/interval
      if (k?.symbol?.toLowerCase() !== symbol.toLowerCase()) return;
      if (k?.interval !== interval) return;
      
      console.log(`📈 Received kline update for ${symbol}:`, k.close);
      series.update({
        time: k.time,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
      });
    });

    socket.on("disconnect", () => {
      console.log(`❌ Socket.IO disconnected for ${symbol}`);
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket.IO connection error:", err.message);
    });

    // Cleanup
    return () => {
      socket.disconnect();
      chart.remove();
    };
  }, [backendBaseUrl, symbol, interval]);

  // Auto-resize handler
  useEffect(() => {
    const onResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      const width = containerRef.current.clientWidth;
      chartRef.current.applyOptions({ width });
    };
    
    window.addEventListener("resize", onResize);
    onResize(); // Initial resize
    
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="w-full">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">{symbol}</h3>
          <p className="text-sm text-gray-400">Live trading chart • {interval} interval</p>
        </div>
        <div className="flex gap-2">
          <button className="text-xs px-3 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600">1m</button>
          <button className="text-xs px-3 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600">5m</button>
          <button className="text-xs px-3 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600">15m</button>
          <button className="text-xs px-3 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600">1h</button>
          <button className="text-xs px-3 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600">4h</button>
          <button className="text-xs px-3 py-1 rounded bg-gray-700 text-gray-300 hover:bg-gray-600">1d</button>
        </div>
      </div>
      <div ref={containerRef} style={{ width: "100%", height: 520 }} />
    </div>
  );
}