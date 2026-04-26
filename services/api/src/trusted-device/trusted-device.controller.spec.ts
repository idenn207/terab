import { Test, TestingModule } from '@nestjs/testing';
import { TrustedDeviceController } from './trusted-device.controller';
import { TrustedDeviceService } from './trusted-device.service';

const mockTrustedDeviceService = {};

describe('TrustedDeviceController', () => {
  let controller: TrustedDeviceController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TrustedDeviceController],
      providers: [{ provide: TrustedDeviceService, useValue: mockTrustedDeviceService }],
    }).compile();

    controller = module.get<TrustedDeviceController>(TrustedDeviceController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
