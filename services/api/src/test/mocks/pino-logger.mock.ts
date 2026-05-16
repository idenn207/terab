import { getLoggerToken } from 'nestjs-pino';

export const mockPinoLogger = {
  trace: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  fatal: jest.fn(),
};

export function createPinoLoggerProvider(context: string) {
  return { provide: getLoggerToken(context), useValue: mockPinoLogger };
}
