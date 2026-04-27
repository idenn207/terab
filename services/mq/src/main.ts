import { ConsoleLogger, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: new ConsoleLogger({
      logLevels: ['error', 'warn'],
    }),
  });
  const configService = app.get(ConfigService);
  const host = configService.get<string>('HOST') || '127.0.0.1';
  const port = configService.get<string>('PORT') || '3001';

  await app.listen(port, host);
  Logger.log(`Application is running on: ${await app.getUrl()}`);
}

bootstrap().catch((err: unknown) => {
  Logger.error('Application failed to start', err);
  process.exit(1);
});
