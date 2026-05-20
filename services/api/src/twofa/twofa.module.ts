import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BackupCodeRepository } from './backup-code.repository';
import { BackupCodeService } from './backup-code.service';
import { PUSH_CHALLENGE_QUEUE, PushChallengePublisher } from './push-challenge.publisher';
import { BackupCodeTwoFaStrategy } from './strategies/backup-code.strategy';
import { PushTwoFaStrategy } from './strategies/push.strategy';
import { TotpTwoFaStrategy } from './strategies/totp.strategy';
import { TWOFA_STRATEGY_TOKEN } from './strategies/twofa-strategy.interface';
import { TwoFaStrategyRegistry } from './strategies/twofa-strategy.registry';
import { TotpLockoutService } from './totp-lockout.service';
import { TotpRepository } from './totp.repository';
import { TotpService } from './totp.service';
import { TwoFaController } from './twofa.controller';
import { TwoFaRepository } from './twofa.repository';
import { TwoFaService } from './twofa.service';

@Module({
  imports: [BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE }), AuthModule],
  controllers: [TwoFaController],
  providers: [
    PushChallengePublisher,
    TwoFaService,
    TwoFaRepository,
    BackupCodeService,
    BackupCodeRepository,
    TotpService,
    TotpRepository,
    TotpLockoutService,
    // Strategy
    PushTwoFaStrategy,
    BackupCodeTwoFaStrategy,
    TotpTwoFaStrategy,
    TwoFaStrategyRegistry,
    {
      provide: TWOFA_STRATEGY_TOKEN,
      useFactory: (push: PushTwoFaStrategy, backupCode: BackupCodeTwoFaStrategy, totp: TotpTwoFaStrategy) => [
        push,
        backupCode,
        totp,
      ],
      inject: [PushTwoFaStrategy, BackupCodeTwoFaStrategy, TotpTwoFaStrategy],
    },
  ],
  exports: [PushChallengePublisher, TwoFaService, BackupCodeService],
})
export class TwoFaModule {}
