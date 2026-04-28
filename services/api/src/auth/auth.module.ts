import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { DeviceModule } from '../device/device.module';
import { TrustedDeviceModule } from '../trusted-device/trusted-device.module';
import { PUSH_CHALLENGE_QUEUE } from '../twofa/push-challenge.publisher';
import { TwoFaModule } from '../twofa/twofa.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE }),
    DeviceModule,
    TwoFaModule,
    TrustedDeviceModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, JwtStrategy],
})
export class AuthModule {}
