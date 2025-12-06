"use client";

import { useEffect, useRef } from "react";
import { createChart, IChartApi, ISeriesApi, CandlestickData } from "lightweight-charts";
import { io } from "socket.io-client";

type Props = {
  backendBaseUrl: string;
  symbol?: string;   // e.g., BTCUSDT
  interval?: string; // e.g., 1m
};

export default function BtcCandles({ backendBaseUrl, symbol = "BTCUSDT", interval = "1m" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Init chart + load history + connect socket
  useEffect(() => {
    if (!containerRef.current) {
      console.error("❌ Container ref is null");
      return;
    }

    console.log("📊 Creating chart...");
    const chart = createChart(containerRef.current, {
      height: 520,
      layout: { background: { color: "#0b0f14" }, textColor: "#e6e9ef" },
      grid: { vertLines: { color: "#1c252f" }, horzLines: { color: "#1c252f" } }
    });
    const series = chart.addCandlestickSeries();
    console.log("✅ Chart created");

    chartRef.current = chart;
    seriesRef.current = series;

    // 1) History
    console.log("📊 Fetching candles from", `${backendBaseUrl}/candles`);
    fetch(`${backendBaseUrl}/candles?symbol=${symbol}&interval=${interval}&limit=500`)
      .then(r => r.json())
      .then((rows: CandlestickData[]) => {
        console.log(`✅ Loaded ${rows.length} candles`);
        series.setData(rows);
        chart.timeScale().fitContent();
      })
      .catch((err) => {
        console.error("❌ Error fetching candles:", err);
      });

    // 2) Live updates
    console.log("🔌 Connecting to Socket.IO:", `${backendBaseUrl}/market`);
    const socket = io(`${backendBaseUrl}/market`, {
      transports: ["polling", "websocket"],
    });

    socket.on("connect", () => {
      console.log("✅ Socket.IO connected to", `${backendBaseUrl}/market`);
    });

    socket.on("kline", (k: any) => {
      // only process events for our symbol/interval
      if (k?.symbol?.toLowerCase() !== symbol.toLowerCase()) return;
      if (k?.interval !== interval) return;
      console.log("📈 Received kline update:", k.close);
      series.update({
        time: k.time,
        open: k.open,
        high: k.high,
        low: k.low,
        close: k.close,
      });
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket.IO disconnected");
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

  // autoresize
  useEffect(() => {
    const onResize = () => {
      if (!containerRef.current || !chartRef.current) return;
      const width = containerRef.current.clientWidth;
      chartRef.current.applyOptions({ width });
    };
    window.addEventListener("resize", onResize);
    onResize();
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: 520 }} />;
}
