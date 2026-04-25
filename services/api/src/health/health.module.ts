import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { DatabaseHealthIndicator } from './indicators/database.health';
import { ServerHealthIndicator } from './indicators/server.health';

@Module({
  imports: [
    TerminusModule.forRoot({
      logger: true,
    }),
  ],
  controllers: [HealthController],
  providers: [DatabaseHealthIndicator, ServerHealthIndicator],
})
export class HealthModule {}
