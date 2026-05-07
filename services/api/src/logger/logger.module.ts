import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { buildLoggerParams } from './logger.config';

@Global()
@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const env = config.get<string>('NODE_ENV') ?? 'prod';
        const logMaxFiles = config.get<number>('LOG_MAX_FILES') ?? 30;
        return buildLoggerParams(env, logMaxFiles);
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
