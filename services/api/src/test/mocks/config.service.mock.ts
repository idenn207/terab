const DEFAULT_CONFIG: Record<string, string> = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  JWT_SECRET: 'test-secret',
  JWT_ACCESS_EXPIRY_MS: '900000',
  JWT_REFRESH_EXPIRY_MS: '604800000',
  PASSWORD_PEPPER: 'test-pepper',
};

const MINIO_CONFIG: Record<string, string> = {
  MINIO_ENDPOINT: 'localhost:9000',
  MINIO_PUBLIC_ENDPOINT: 'http://localhost:9000',
  MINIO_ROOT_USER: 'minioadmin',
  MINIO_ROOT_PASSWORD: 'minioadmin',
  MINIO_DEFAULT_BUCKETS: 'drive',
};

const CONFIG = { ...DEFAULT_CONFIG, ...MINIO_CONFIG };

export const mockConfigService = {
  getOrThrow: jest.fn((key: string) => CONFIG[key]),
  get: jest.fn().mockReturnValue(undefined),
};
