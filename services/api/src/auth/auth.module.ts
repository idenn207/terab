import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { BackupCodeModule } from '../backup-code/backup-code.module';
import { DeviceModule } from '../device/device.module';
import { InvitationModule } from '../invitation/invitation.module';
import { RoleModule } from '../role/role.module';
import { SessionModule } from '../session/session.module';
import { TrustedDeviceModule } from '../trusted-device/trusted-device.module';
import { PUSH_CHALLENGE_QUEUE } from '../twofa/push-challenge.publisher';
import { TwoFaModule } from '../twofa/twofa.module';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE }),
    DeviceModule,
    TwoFaModule,
    TrustedDeviceModule,
    InvitationModule,
    SessionModule,
    BackupCodeModule,
    UserModule,
    RoleModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
})
export class AuthModule {}
