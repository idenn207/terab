import { Global, Module } from '@nestjs/common';
import { TokenModule } from './security/token.module';

@Global()
@Module({
  imports: [TokenModule],
  exports: [TokenModule],
})
export class CoreModule {}
