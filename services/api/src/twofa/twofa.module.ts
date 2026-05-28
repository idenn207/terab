import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TrustedDeviceModule } from '../trusted-device/trusted-device.module';
import { BackupCodeModule } from './backup-code/backup-code.module';
import { ChallengeController } from './challenge.controller';
import { PUSH_CHALLENGE_QUEUE, PushChallengePublisher } from './push-challenge.publisher';
import { BackupCodeTwoFaStrategy } from './strategies/backup-code.strategy';
import { PushTwoFaStrategy } from './strategies/push.strategy';
import { TotpTwoFaStrategy } from './strategies/totp.strategy';
import { TWOFA_STRATEGY_TOKEN } from './strategies/twofa-strategy.interface';
import { TwoFaStrategyRegistry } from './strategies/twofa-strategy.registry';
import { TotpLockoutService } from './totp-lockout.service';
import { TotpController } from './totp.controller';
import { TotpRepository } from './totp.repository';
import { TotpService } from './totp.service';
import { TwoFaRepository } from './twofa.repository';
import { TwoFaService } from './twofa.service';

@Module({
  imports: [BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE }), AuthModule, BackupCodeModule, TrustedDeviceModule],
  controllers: [ChallengeController, TotpController],
  providers: [
    PushChallengePublisher,
    TwoFaService,
    TwoFaRepository,
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
  exports: [PushChallengePublisher, TwoFaService],
})
export class TwoFaModule {}
