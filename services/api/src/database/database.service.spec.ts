import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { mockConfigService } from '@terab/test';
import { DrizzleQueryLogger } from '../logger/drizzle-query-logger';
import { DatabaseService } from './database.service';

const mockDrizzleQueryLogger = {
  logQuery: jest.fn(),
};

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DatabaseService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DrizzleQueryLogger, useValue: mockDrizzleQueryLogger },
      ],
    }).compile();

    service = module.get(DatabaseService);
  });

  it('db 인스턴스를 노출한다', () => {
    expect(service.db).toBeDefined();
  });
});
