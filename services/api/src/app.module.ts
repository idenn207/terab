import { BullModule } from '@nestjs/bullmq';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ApiExceptionFilter, JwtAuthGuard, PermissionGuard } from '@terab/common';
import { CoreModule } from '@terab/core';
import { DatabaseModule } from '@terab/db';
import { AuthModule } from './auth/auth.module';
import { DeviceModule } from './device/device.module';
import { HealthModule } from './health/health.module';
import { TrustedDeviceModule } from './trusted-device/trusted-device.module';
import { TwoFaModule } from './twofa/twofa.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.getOrThrow<string>('REDIS_HOST'),
          port: Number(config.getOrThrow<string>('REDIS_PORT')),
        },
      }),
    }),
    DatabaseModule,
    CoreModule,
    HealthModule,
    AuthModule,
    DeviceModule,
    TrustedDeviceModule,
    TwoFaModule,
  ],
  providers: [
    // 전역 Guard: ThrottlerGuard → JwtAuthGuard(401) → PermissionGuard(403) 순서 보장
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    // 전역 Exception Filter
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    // 전역 Validation Pipe
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule {}
