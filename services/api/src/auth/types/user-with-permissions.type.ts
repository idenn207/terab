export interface UserWithPermissions {
  id: string;
  username: string;
  nickname: string;
  password: string;
  active: boolean;
  permissions: string[];
}
