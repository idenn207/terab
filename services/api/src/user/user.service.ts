import { Injectable } from '@nestjs/common';
import { DatabaseService, ServiceCore, TransactionContext, Users$Insert, Users$Select } from '@terab/db';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService extends ServiceCore {
  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly userRepository: UserRepository,
  ) {
    super(database, txContext);
  }

  async findById(id: string): Promise<Users$Select | null> {
    return this.userRepository.findById(id);
  }

  async findByUsername(username: string): Promise<Users$Select | null> {
    return this.userRepository.findByUsername(username);
  }

  async create(data: Pick<Users$Insert, 'username' | 'nickname' | 'password'>): Promise<{ id: string }> {
    return this.userRepository.insert(data);
  }
}
