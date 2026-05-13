import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createPinoLoggerProvider, mockConfigService } from '@terab/test';
import { MinioService } from './minio.service';

describe('MinioService', () => {
  let service: MinioService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        MinioService,
        { provide: ConfigService, useValue: mockConfigService },
        createPinoLoggerProvider(MinioService.name),
      ],
    }).compile();

    service = module.get<MinioService>(MinioService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
