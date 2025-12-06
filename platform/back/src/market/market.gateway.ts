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

  private binanceWs?: any;
  private wsUrl = process.env.BINANCE_WS || 'wss://stream.binance.com:9443/ws';
  private symbol = (process.env.DEFAULT_SYMBOL || 'BTCUSDT').toLowerCase();
  private interval = process.env.DEFAULT_INTERVAL || '1m';

  onModuleInit() {
    this.connect();
  }

  private connect() {
    const stream = `${this.symbol}@kline_${this.interval}`;
    const url = `${this.wsUrl}/${stream}`;
    this.binanceWs = new WS(url);

    this.binanceWs.on('open', () => {
      // eslint-disable-next-line no-console
      console.log('Connected to Binance stream:', stream);
    });

    this.binanceWs.on('message', (raw: Buffer) => {
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
      } catch (_) {}
    });

    this.binanceWs.on('close', () => {
      // eslint-disable-next-line no-console
      console.log('Binance WS closed. Reconnecting in 3s...');
      setTimeout(() => this.connect(), 3000);
    });

    this.binanceWs.on('error', () => {
      // eslint-disable-next-line no-console
      console.log('Binance WS error. Reconnecting in 3s...');
      try { this.binanceWs.close(); } catch {}
      setTimeout(() => this.connect(), 3000);
    });
  }
}
