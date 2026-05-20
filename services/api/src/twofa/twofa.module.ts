import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BackupCodeRepository } from './backup-code.repository';
import { BackupCodeService } from './backup-code.service';
import { PUSH_CHALLENGE_QUEUE, PushChallengePublisher } from './push-challenge.publisher';
import { TwoFaController } from './twofa.controller';
import { TwoFaRepository } from './twofa.repository';
import { TwoFaService } from './twofa.service';

@Module({
  imports: [BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE })],
  controllers: [TwoFaController],
  providers: [PushChallengePublisher, TwoFaService, TwoFaRepository, BackupCodeService, BackupCodeRepository],
  exports: [PushChallengePublisher, TwoFaService, BackupCodeService],
})
export class TwoFaModule {}
