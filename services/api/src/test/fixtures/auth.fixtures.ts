import { AuthUser } from '../../auth/types/auth-user.type';

export const mockUser = {
  id: 'uuid-1',
  username: 'user1',
  nickname: 'User One',
  password: '$2a$10$hashedpassword',
  active: true,
  permissions: ['file:read'],
};
export const mockAdmin = {
  id: 'uuid-1',
  username: 'admin1',
  nickname: 'Admin One',
  password: '$2a$10$hashedpassword',
  active: true,
  permissions: ['user:invite', 'user:manage'],
};
export const mockAuthUser: AuthUser = {
  userId: 'uuid-1',
  username: 'user1',
  permissions: ['file:read'],
};
export const mockAuthAdmin: AuthUser = {
  userId: 'uuid-1',
  username: 'admin1',
  permissions: ['user:invite', 'user:manage'],
};
