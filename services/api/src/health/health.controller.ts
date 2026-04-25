import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { HealthCheckService } from '@nestjs/terminus';
import { Public } from '@terab/decorator';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { ServerHealthIndicator } from './indicators/server.health';

@Controller('api/health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: DatabaseHealthIndicator,
    private readonly server: ServerHealthIndicator,
  ) {}

  @Public()
  @Get()
  @HttpCode(HttpStatus.OK)
  check() {
    return this.health.check([() => this.db.isHealthy('database'), () => this.server.isHealthy('api')]);
  }
}
