import { Test } from '@nestjs/testing';
import { AuthRepository } from './auth.repository.js';
import { DatabaseService } from '../database/database.service.js';

const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();

const mockDatabaseService = {
  db: {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
  },
};

describe('AuthRepository', () => {
  let repo: AuthRepository;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AuthRepository,
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    repo = module.get(AuthRepository);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(repo).toBeDefined();
  });
});
