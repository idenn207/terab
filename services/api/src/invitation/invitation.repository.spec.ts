import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from '@terab/db';
import { mockDatabaseService } from '@terab/test';
import { InvitationRepository } from './invitation.repository';

describe('InvitationRepository', () => {
  let repo: InvitationRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InvitationRepository, { provide: DatabaseService, useValue: mockDatabaseService }],
    }).compile();

    repo = module.get<InvitationRepository>(InvitationRepository);
  });

  it('should be defined', () => {
    expect(repo).toBeDefined();
  });
});
