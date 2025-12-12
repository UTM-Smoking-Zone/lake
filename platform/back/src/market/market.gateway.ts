import { OnModuleInit } from '@nestjs/common';
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

// using 'ws' for the upstream Binance stream
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WS = require('ws');

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/market',
})
export class MarketGateway implements OnModuleInit {
  @WebSocketServer() server!: Server;

  private binanceConnections: Map<string, any> = new Map();
  private wsUrl = process.env.BINANCE_WS || 'wss://stream.binance.com:9443/ws';
  private interval = process.env.DEFAULT_INTERVAL || '1m';
  
  // Multiple symbols to track
  private symbols = [
    'BTCUSDT',
    'ETHUSDT', 
    'BNBUSDT',
    'XRPUSDT',
    'SOLUSDT',
    'ADAUSDT',
    'DOGEUSDT',
    'TRXUSDT',
    'MATICUSDT',
    'AVAXUSDT'
  ];

  onModuleInit() {
    this.connectToAll();
  }

  private connectToAll() {
    // Connect to each symbol separately for better reliability
    this.symbols.forEach(symbol => {
      this.connectToSymbol(symbol);
    });
  }

  private connectToSymbol(symbol: string) {
    const stream = `${symbol.toLowerCase()}@kline_${this.interval}`;
    const url = `${this.wsUrl}/${stream}`;
    
    const ws = new WS(url);
    
    ws.on('open', () => {
      console.log(`✅ Connected to Binance stream for ${symbol}`);
    });

    ws.on('message', (raw: Buffer) => {
      try {
        const payload = JSON.parse(raw.toString());
        const k = payload.k; // kline object
        if (!k) return;
        
        this.server.emit('kline', {
          time: Math.floor(k.t / 1000),
          open: +k.o,
          high: +k.h,
          low: +k.l,
          close: +k.c,
          isFinal: !!k.x,
          interval: k.i,
          symbol: k.s
        });
      } catch (error) {
        console.error(`Error parsing WebSocket message for ${symbol}:`, error);
      }
    });

    ws.on('close', () => {
      console.log(`❌ Binance WS closed for ${symbol}. Reconnecting in 3s...`);
      setTimeout(() => this.connectToSymbol(symbol), 3000);
    });

    ws.on('error', (error: any) => {
      console.log(`❌ Binance WS error for ${symbol}:`, error.message, 'Reconnecting in 3s...');
      try { 
        this.binanceConnections.delete(symbol);
        ws.close(); 
      } catch {}
      setTimeout(() => this.connectToSymbol(symbol), 3000);
    });

    this.binanceConnections.set(symbol, ws);
  }
}
