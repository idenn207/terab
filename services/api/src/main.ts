import { ConsoleLogger, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      logLevels: ['error', 'warn'],
    }),
  });
  const configService = app.get(ConfigService);
  const host = configService.get<string>('HOST') || '0.0.0.0';
  const port = configService.get<string>('PORT') || '3000';

  // ───── Settings ──────────────────────────────
  app.use(helmet());
  app.use(cookieParser());

  const allowedOrigins = configService
    .getOrThrow<string>('CORS_ALLOWED_ORIGINS')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

  // ───── Swagger ─────────────────────────
  // 모든 Route 주소 확인용
  const config = new DocumentBuilder().setTitle('API Docs').build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('swagger', app, document); // http://localhost:3000/swagger 로 접속

  // ───── Listen ─────────────────────────
  await app.listen(port, host);
  Logger.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap().catch((err: unknown) => {
  Logger.error('Application failed to start', err);
  process.exit(1);
});
