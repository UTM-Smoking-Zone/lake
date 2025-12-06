import { Controller, Get, Query } from '@nestjs/common';
import { CandlesService } from './candles.service';

@Controller('candles')
export class CandlesController {
  constructor(private readonly svc: CandlesService) {}

  @Get()
  get(
    @Query('symbol') symbol?: string,
    @Query('interval') interval?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getKlines(symbol, interval, limit ? Number(limit) : undefined);
  }
}
