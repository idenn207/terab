import { Module } from '@nestjs/common';
import { StorageAgentClient } from './storage-agent.client';

@Module({
  providers: [StorageAgentClient],
  exports: [StorageAgentClient],
})
export class StorageAgentModule {}
