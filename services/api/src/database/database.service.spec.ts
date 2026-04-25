import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { mockConfigService } from '@terab/test';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DatabaseService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    service = module.get(DatabaseService);
  });

  it('db 인스턴스를 노출한다', () => {
    expect(service.db).toBeDefined();
  });
});
