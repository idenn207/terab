import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryModule } from '@nestjs/core';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { DrizzleQueryLogger } from './drizzle-query-logger';
import { TraceInterceptor } from './interceptors/trace.interceptor';
import { buildLoggerParams } from './logger.config';
import { PiiMasker } from './pii-masker';
import { ServiceMethodWrapper } from './service-method-wrapper';
import { TraceFlusher } from './trace.flusher';

@Global()
@Module({
  imports: [
    DiscoveryModule,
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const env = config.get<string>('NODE_ENV') ?? 'prod';
        const logMaxFiles = +(config.get<string>('LOG_MAX_FILES') ?? 30);
        return buildLoggerParams(env, logMaxFiles);
      },
    }),
  ],
  providers: [PiiMasker, ServiceMethodWrapper, TraceFlusher, TraceInterceptor, DrizzleQueryLogger],
  exports: [PinoLoggerModule, DrizzleQueryLogger, TraceInterceptor, TraceFlusher],
})
export class LoggerModule {}
