import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger as PinoLogger } from 'nestjs-pino';
import { AppModule } from './app.module';
import metadata from './metadata';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const pinoLogger = app.get(PinoLogger);
  app.useLogger(pinoLogger);

  const configService = app.get(ConfigService);
  const host = configService.get<string>('HOST') || '0.0.0.0';
  const port = configService.get<string>('PORT') || '3000';

  // ───── Settings ──────────────────────────────
  app.use(helmet());
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  const allowedOrigins = configService
    .getOrThrow<string>('CORS_ALLOWED_ORIGINS')
    .split(',')
    .map((o) => o.trim());

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  });

  // ───── Swagger ─────────────────────────
  // 모든 Route 주소 확인용 (개발용)
  if (configService.get<string>('NODE_ENV') === 'dev') {
    await SwaggerModule.loadPluginMetadata(metadata);
    const config = new DocumentBuilder().setTitle('API Docs').addBearerAuth().build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('swagger', app, document, { jsonDocumentUrl: '/json' }); // http://localhost:3000/swagger 로 접속
  }

  // ───── Listen ─────────────────────────
  await app.listen(port, host);
  pinoLogger.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap().catch((err: unknown) => {
  console.error('Application failed to start', err);
  process.exit(1);
});
