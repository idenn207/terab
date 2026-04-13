interface User {
  id: string;
  username: string;
  nickname: string;
}
type UserRole = 'OWNER' | 'ADMIN' | 'USER';

export type { User, UserRole };
