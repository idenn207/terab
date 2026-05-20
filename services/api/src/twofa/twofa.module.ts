import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BackupCodeRepository } from './backup-code.repository';
import { BackupCodeService } from './backup-code.service';
import { PUSH_CHALLENGE_QUEUE, PushChallengePublisher } from './push-challenge.publisher';
import { BackupCodeTwoFaStrategy } from './strategies/backup-code.strategy';
import { PushTwoFaStrategy } from './strategies/push.strategy';
import { TWOFA_STRATEGY_TOKEN } from './strategies/twofa-strategy.interface';
import { TwoFaStrategyRegistry } from './strategies/twofa-strategy.registry';
import { TwoFaController } from './twofa.controller';
import { TwoFaRepository } from './twofa.repository';
import { TwoFaService } from './twofa.service';

@Module({
  imports: [BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE })],
  controllers: [TwoFaController],
  providers: [
    PushChallengePublisher,
    TwoFaService,
    TwoFaRepository,
    BackupCodeService,
    BackupCodeRepository,
    PushTwoFaStrategy,
    BackupCodeTwoFaStrategy,
    TwoFaStrategyRegistry,
    {
      provide: TWOFA_STRATEGY_TOKEN,
      useFactory: (push: PushTwoFaStrategy, backupCode: BackupCodeTwoFaStrategy) => [push, backupCode],
      inject: [PushTwoFaStrategy, BackupCodeTwoFaStrategy],
    },
  ],
  exports: [PushChallengePublisher, TwoFaService, BackupCodeService],
})
export class TwoFaModule {}
