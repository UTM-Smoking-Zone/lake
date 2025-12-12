import { Module } from '@nestjs/common';
import { CandlesModule } from './candles/candles.module';
import { MarketGateway } from './market/market.gateway';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [CandlesModule, AuthModule],
  providers: [MarketGateway],
})
export class AppModule {}
