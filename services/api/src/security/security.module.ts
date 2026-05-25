import { Global, Module } from '@nestjs/common';
import { EncryptionService } from './encryption.service';
import { TokenModule } from './token.module';

@Global()
@Module({
  imports: [TokenModule],
  providers: [EncryptionService],
  exports: [TokenModule, EncryptionService],
})
export class SecurityModule {}
