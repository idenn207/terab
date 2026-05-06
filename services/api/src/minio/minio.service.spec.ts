import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { MinioService } from './minio.service';

describe('MinioService', () => {
  let service: MinioService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MinioService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: (key: string) => {
              const map: Record<string, string> = {
                MINIO_ENDPOINT: 'localhost:9000',
                MINIO_ROOT_USER: 'minioadmin',
                MINIO_ROOT_PASSWORD: 'minioadmin',
                MINIO_DEFAULT_BUCKETS: 'drive',
              };
              return map[key];
            },
          },
        },
      ],
    }).compile();

    service = module.get<MinioService>(MinioService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
