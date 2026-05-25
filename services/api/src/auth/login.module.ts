import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { DeviceModule } from '../device/device.module';
import { InvitationModule } from '../invitation/invitation.module';
import { TrustedDeviceModule } from '../trusted-device/trusted-device.module';
import { BackupCodeModule } from '../twofa/backup-code/backup-code.module';
import { PUSH_CHALLENGE_QUEUE } from '../twofa/push-challenge.publisher';
import { TwoFaModule } from '../twofa/twofa.module';
import { UserModule } from '../user/user.module';
import { AuthModule } from './auth.module';
import { LoginController } from './login.controller';
import { LoginService } from './login.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE }),
    PassportModule,
    AuthModule,
    DeviceModule,
    TrustedDeviceModule,
    BackupCodeModule,
    InvitationModule,
    UserModule,
    TwoFaModule,
  ],
  controllers: [LoginController],
  providers: [LoginService, JwtStrategy],
  exports: [LoginService],
})
export class LoginModule {}
