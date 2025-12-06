import { Module } from '@nestjs/common';
import { CandlesService } from './candles.service';
import { CandlesController } from './candles.controller';

@Module({
  providers: [CandlesService],
  controllers: [CandlesController],
})
export class CandlesModule {}
