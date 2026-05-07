import type { Params } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import { IncomingMessage } from 'node:http';

export function buildLoggerParams(env: string, logMaxFiles: number): Params {
  const isDev = env === 'dev';

  return {
    pinoHttp: {
      level: isDev ? 'debug' : 'warn',
      autoLogging: false,
      genReqId: (req: IncomingMessage) => {
        const existing = req.headers['x-request-id'];
        if (typeof existing === 'string' && existing) return existing;
        return randomUUID();
      },
      transport: isDev
        ? {
            target: 'pino-pretty',
            options: { colorize: true, singleLine: false },
          }
        : {
            target: 'pino-roll',
            options: {
              files: '/app/logs/app.log',
              frequency: 'daily',
              mkdir: true,
              limit: { count: logMaxFiles },
            },
          },
    },
  };
}
