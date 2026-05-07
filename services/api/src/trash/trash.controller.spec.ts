import { Test, TestingModule } from '@nestjs/testing';
import { TrashController } from './trash.controller';
import { TrashService } from './trash.service';

const mockTrashService = { list: jest.fn(), restore: jest.fn(), permanentDelete: jest.fn() };

describe('TrashController', () => {
  let controller: TrashController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrashController],
      providers: [{ provide: TrashService, useValue: mockTrashService }],
    }).compile();

    controller = module.get<TrashController>(TrashController);
    jest.clearAllMocks();
  });

  it('인스턴스가 생성된다', () => {
    expect(controller).toBeDefined();
  });
});
