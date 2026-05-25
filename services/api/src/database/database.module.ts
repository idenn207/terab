import { Global, Module } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { OwnerSeeder, RbacSeeder } from './seed';
import { TransactionContext } from './transaction-context';

@Global()
@Module({
  providers: [DatabaseService, TransactionContext, RbacSeeder, OwnerSeeder],
  exports: [DatabaseService, TransactionContext],
})
export class DatabaseModule {}
