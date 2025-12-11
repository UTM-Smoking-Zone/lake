import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check() {
    return {
      status: 'healthy',
      service: 'market-data-service',
      timestamp: new Date().toISOString(),
    };
  }
}
