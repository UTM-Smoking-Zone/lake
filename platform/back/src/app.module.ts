import { Module } from '@nestjs/common';
import { CandlesModule } from './candles/candles.module';
import { MarketGateway } from './market/market.gateway';

@Module({
  imports: [CandlesModule],
  providers: [MarketGateway],
})
export class AppModule {}
