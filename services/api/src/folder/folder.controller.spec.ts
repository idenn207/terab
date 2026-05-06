import { Test } from '@nestjs/testing';
import { FolderController } from './folder.controller';
import { FolderService } from './folder.service';

const mockFolderService = {
  getRoot: jest.fn(),
  getChildren: jest.fn(),
  create: jest.fn(),
  rename: jest.fn(),
  move: jest.fn(),
  remove: jest.fn(),
};

describe('FolderController', () => {
  let controller: FolderController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [FolderController],
      providers: [{ provide: FolderService, useValue: mockFolderService }],
    }).compile();

    controller = module.get<FolderController>(FolderController);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(controller).toBeDefined();
  });
});
