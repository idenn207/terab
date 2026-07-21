import { Module } from '@nestjs/common';
import { InvitationModule } from '../invitation/invitation.module';
import { UserModule } from '../user/user.module';
import { InvitationAdminController } from './invitation-admin.controller';
import { UserAdminController } from './user-admin.controller';

@Module({
  imports: [InvitationModule, UserModule],
  controllers: [InvitationAdminController, UserAdminController],
  providers: [],
})
export class AdminModule {}
