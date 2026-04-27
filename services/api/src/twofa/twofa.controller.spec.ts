import { Test, TestingModule } from '@nestjs/testing';
import { TrustedDeviceService } from '../trusted-device/trusted-device.service';
import { TwoFaController } from './twofa.controller';
import { TwoFaService } from './twofa.service';

const mockTwoFaService = {};
const mockTrustedDeviceService = {};

describe('TwoFaController', () => {
  let controller: TwoFaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [],
      controllers: [TwoFaController],
      providers: [
        { provide: TwoFaService, useValue: mockTwoFaService },
        { provide: TrustedDeviceService, useValue: mockTrustedDeviceService },
      ],
    }).compile();

    controller = module.get<TwoFaController>(TwoFaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
