import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DrizzleQueryLogger } from '@terab/logger';
import { mockConfigService } from '@terab/test';
import { DatabaseService } from './database.service';
import { OwnerSeeder, RbacSeeder } from './seed';

const mockDrizzleQueryLogger = {
  logQuery: jest.fn(),
};

const mockRbacSeeder = {
  seed: jest.fn(),
};

const mockOwnerSeeder = {
  seed: jest.fn(),
};

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DatabaseService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: DrizzleQueryLogger, useValue: mockDrizzleQueryLogger },
        { provide: RbacSeeder, useValue: mockRbacSeeder },
        { provide: OwnerSeeder, useValue: mockOwnerSeeder },
      ],
    }).compile();

    service = module.get(DatabaseService);
  });

  it('db 인스턴스를 노출한다', () => {
    expect(service.db).toBeDefined();
  });
});
