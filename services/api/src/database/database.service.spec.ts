import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('postgresql://test:test@localhost:5432/test'),
          },
        },
      ],
    }).compile();

    service = module.get(DatabaseService);
  });

  it('db 인스턴스를 노출한다', () => {
    expect(service.db).toBeDefined();
  });
});
