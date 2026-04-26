import { Module } from '@nestjs/common';
import { TrustedDeviceController } from './trusted-device.controller';
import { TrustedDeviceRepository } from './trusted-device.repository';
import { TrustedDeviceService } from './trusted-device.service';

@Module({
  controllers: [TrustedDeviceController],
  providers: [TrustedDeviceService, TrustedDeviceRepository],
  exports: [TrustedDeviceService],
})
export class TrustedDeviceModule {}
