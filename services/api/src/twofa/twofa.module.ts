import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { TrustedDeviceModule } from '../trusted-device/trusted-device.module';
import { PUSH_CHALLENGE_QUEUE, PushChallengePublisher } from './push-challenge.publisher';
import { TwoFaController } from './twofa.controller';
import { TwoFaRepository } from './twofa.repository';
import { TwoFaService } from './twofa.service';

@Module({
  imports: [TrustedDeviceModule, BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE })],
  controllers: [TwoFaController],
  providers: [TwoFaService, TwoFaRepository, PushChallengePublisher],
  exports: [TwoFaService, PushChallengePublisher],
})
export class TwoFaModule {}
