import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { FcmModule } from './fcm/fcm.module';
import { PushWorker } from './push.worker';

@Module({
  imports: [FcmModule, BullModule.registerQueue({ name: 'push-challenge' })],
  providers: [PushWorker],
})
export class PushModule {}
