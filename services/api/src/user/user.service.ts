import { Injectable } from '@nestjs/common';
import { ApiException, UserDto } from '@terab/common';
import { DatabaseService, ServiceCore, TransactionContext, Users$Insert, Users$Select } from '@terab/db';
import { RoleService } from '../auth/role/role.service';
import { AdminUserListResponseDto, ListUsersQueryDto } from './dto';
import { UserRepository } from './user.repository';

@Injectable()
export class UserService extends ServiceCore {
  protected readonly DEFAULT_LIST_LIMIT = 50;
  protected readonly DEFAULT_LIST_OFFSET = 0;

  constructor(
    database: DatabaseService,
    txContext: TransactionContext,
    private readonly userRepository: UserRepository,
    private readonly roleService: RoleService,
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

  async getCurrentUser(userId: string): Promise<UserDto> {
    const user = await this.userRepository.findById(userId);
    if (!user) throw new ApiException('INVALID_CREDENTIALS');
    const permissions = await this.roleService.getPermissionsByUserId(user.id);
    return { id: user.id, username: user.username, nickname: user.nickname, permissions };
  }

  async listUsers(query: ListUsersQueryDto): Promise<AdminUserListResponseDto> {
    const limit = query.limit ?? this.DEFAULT_LIST_LIMIT;
    const offset = query.offset ?? this.DEFAULT_LIST_OFFSET;
    const { items, total } = await this.userRepository.listUsers(limit, offset);
    const rolesByUserId = await this.roleService.getRoleNamesByUserIds(items.map((u) => u.id));
    return {
      items: items.map((u) => ({
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        createdAt: u.createdAt,
        roleNames: rolesByUserId.get(u.id) ?? [],
      })),
      total,
      limit,
      offset,
    };
  }
}
