import { Module } from '@nestjs/common';
import { DriveModule } from '../drive/drive.module';
import { StorageAgentModule } from '../storage-agent/storage-agent.module';
import { MountCredentialController } from './mount-credential.controller';
import { MountCredentialRepository } from './mount-credential.repository';
import { MountCredentialService } from './mount-credential.service';
import { SecretStoreFactory } from './secret-store';

@Module({
  imports: [DriveModule, StorageAgentModule],
  controllers: [MountCredentialController],
  providers: [MountCredentialService, MountCredentialRepository, SecretStoreFactory],
  exports: [MountCredentialService],
})
export class MountCredentialModule {}
