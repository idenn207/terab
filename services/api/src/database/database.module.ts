import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { TransactionContext } from './transaction-context';

@Global()
@Module({
  providers: [DatabaseService, TransactionContext],
  exports: [DatabaseService, TransactionContext],
})
export class DatabaseModule {}
