import { Module } from '@nestjs/common';
import { CandlesModule } from './candles/candles.module';
import { MarketGateway } from './market/market.gateway';
import { HealthController } from './health/health.controller';

@Module({
  imports: [CandlesModule],
  controllers: [HealthController],
  providers: [MarketGateway],
})
export class AppModule {}
