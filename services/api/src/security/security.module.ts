import { Global, Module } from '@nestjs/common';
import { TokenModule } from './token.module';

@Global()
@Module({
  imports: [TokenModule],
  exports: [TokenModule],
})
export class SecurityModule {}
