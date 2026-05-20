import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PUSH_CHALLENGE_QUEUE } from '../twofa/push-challenge.publisher';
import { AuthService } from './auth.service';
import { RoleModule } from './role/role.module';
import { SessionModule } from './session/session.module';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [PassportModule, BullModule.registerQueue({ name: PUSH_CHALLENGE_QUEUE }), SessionModule, RoleModule],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, SessionModule, RoleModule],
})
export class AuthModule {}
