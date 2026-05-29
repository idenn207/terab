import { createKeyv } from '@keyv/redis';
import { BullModule } from '@nestjs/bullmq';
import { CacheModule } from '@nestjs/cache-manager';
import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ApiExceptionFilter, JwtAuthGuard, PermissionGuard } from '@terab/common';
import { DatabaseModule } from '@terab/db';
import { LoggerModule, TraceInterceptor } from '@terab/logger';
import { SecurityModule } from '@terab/security';
import { AuthModule } from './auth/auth.module';
import { LoginModule } from './auth/login.module';
import { DeviceModule } from './device/device.module';
import { DriveModule } from './drive/drive.module';
import { FileModule } from './file/file.module';
import { FolderModule } from './folder/folder.module';
import { HealthModule } from './health/health.module';
import { InvitationModule } from './invitation/invitation.module';
import { MinioModule } from './minio/minio.module';
import { StorageAgentModule } from './storage-agent/storage-agent.module';
import { TrashModule } from './trash/trash.module';
import { TrustedDeviceModule } from './trusted-device/trusted-device.module';
import { TwoFaModule } from './twofa/twofa.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const store = createKeyv(config.getOrThrow<string>('REDIS_URL'));
        store.namespace = 'cache';
        return { stores: [store], ttl: 60_000 };
      },
    }),
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.getOrThrow<string>('REDIS_URL'),
        },
      }),
    }),
    DatabaseModule,
    MinioModule,
    SecurityModule,
    HealthModule,
    UserModule,
    AuthModule,
    DeviceModule,
    TrustedDeviceModule,
    TwoFaModule,
    InvitationModule,
    LoginModule,
    FolderModule,
    FileModule,
    TrashModule,
    StorageAgentModule,
    DriveModule,
  ],
  providers: [
    // 전역 Guard: ThrottlerGuard → JwtAuthGuard(401) → PermissionGuard(403) 순서 보장
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
    // 전역 Interceptor
    { provide: APP_INTERCEPTOR, useClass: TraceInterceptor },
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
