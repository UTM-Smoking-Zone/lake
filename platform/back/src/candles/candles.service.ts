import axios from 'axios';
import { Injectable } from '@nestjs/common';
import { Candle } from '../common/types.js';

@Injectable()
export class CandlesService {
  private rest = process.env.BINANCE_REST || 'https://api.binance.com';

  async getKlines(
    symbol = process.env.DEFAULT_SYMBOL || 'BTCUSDT',
    interval = process.env.DEFAULT_INTERVAL || '1m',
    limit = Number(process.env.DEFAULT_LIMIT || 500)
  ): Promise<Candle[]> {
    const url = `${this.rest}/api/v3/klines`;
    const { data } = await axios.get(url, { params: { symbol, interval, limit } });
    return (data as any[]).map((k) => ({
      time: Math.floor(k[0] / 1000),
      open: +k[1],
      high: +k[2],
      low: +k[3],
      close: +k[4],
    }));
  }
}
