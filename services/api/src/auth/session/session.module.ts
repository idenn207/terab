import { Module } from '@nestjs/common';
import { SessionRepository } from './session.repository';
import { SessionService } from './session.service';

@Module({
  providers: [SessionService, SessionRepository],
  exports: [SessionService],
})
export class SessionModule {}
