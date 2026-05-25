import { Module } from '@nestjs/common';
import { AuthModule } from '../../auth/auth.module';
import { UserModule } from '../../user/user.module';
import { BackupCodeController } from './backup-code.controller';
import { BackupCodeRepository } from './backup-code.repository';
import { BackupCodeService } from './backup-code.service';

@Module({
  imports: [AuthModule, UserModule],
  controllers: [BackupCodeController],
  providers: [BackupCodeService, BackupCodeRepository],
  exports: [BackupCodeService],
})
export class BackupCodeModule {}
