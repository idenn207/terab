import { DynamicModule, Global, Module } from '@nestjs/common';
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
  imports: [DiscoveryModule],
  providers: [PiiMasker, ServiceMethodWrapper, TraceFlusher, TraceInterceptor, DrizzleQueryLogger],
  exports: [DrizzleQueryLogger, TraceInterceptor, TraceFlusher],
})
export class LoggerModule {
  // nestjs-pino@4의 createProvidersForDecorated()는 forRootAsync 호출 시점에 동기 실행되어
  // @InjectPinoLogger의 decorated context Set을 스냅샷한다. 정적 @Module() 내에서 호출하면
  // 이 파일이 로드되는 시점에만 등록된 컨텍스트만 캡처되므로, 후행 모듈(TwoFa/File 등)의
  // @InjectPinoLogger 토큰이 누락된다. forRoot()로 옮겨 AppModule decorator 평가 시점
  // (= 모든 import 완료 후)에 호출되도록 한다.
  static forRoot(): DynamicModule {
    const pinoModule = PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const env = config.get<string>('NODE_ENV') ?? 'prod';
        const logMaxFiles = +(config.get<string>('LOG_MAX_FILES') ?? 30);
        return buildLoggerParams(env, logMaxFiles);
      },
    });
    return {
      module: LoggerModule,
      imports: [pinoModule],
      exports: [pinoModule],
    };
  }
}
