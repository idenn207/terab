import { Module } from '@nestjs/common';
import { RoleModule } from '../auth/role/role.module';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

@Module({
  imports: [RoleModule],
  providers: [UserService, UserRepository],
  exports: [UserService],
})
export class UserModule {}
