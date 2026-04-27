import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PUSH_CHALLENGE_QUEUE, PushChallengePublisher } from './push-challenge.publisher';
import { TwoFaController } from './twofa.controller';
import { TwoFaRepository } from './twofa.repository';
import { TwoFaService } from './twofa.service';

@Module({
  imports: [BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE })],
  controllers: [TwoFaController],
  providers: [TwoFaService, TwoFaRepository, PushChallengePublisher],
  exports: [TwoFaService, PushChallengePublisher],
})
export class TwoFaModule {}
