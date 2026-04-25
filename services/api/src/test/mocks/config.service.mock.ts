const DEFAULT_CONFIG: Record<string, string> = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_SECRET: 'test-secret',
  JWT_ACCESS_EXPIRY_MS: '900000',
  JWT_REFRESH_EXPIRY_MS: '604800000',
  PASSWORD_PEPPER: 'test-pepper',
};

export const mockConfigService = {
  getOrThrow: jest.fn((key: string) => DEFAULT_CONFIG[key]),
  get: jest.fn().mockReturnValue(undefined),
};
