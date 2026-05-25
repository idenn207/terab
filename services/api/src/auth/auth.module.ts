import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { AuthService } from './auth.service';
import { RoleModule } from './role/role.module';
import { SessionModule } from './session/session.module';

@Module({
  imports: [SessionModule, RoleModule, UserModule],
  providers: [AuthService],
  exports: [AuthService, SessionModule, RoleModule],
})
export class AuthModule {}
