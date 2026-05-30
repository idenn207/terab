import type { AdminUserListItemDto } from '@shared/api';

// 관리자가 운영하는 사용자 엔티티. entities/user 의 자기 식별(User) 과 구분된다 —
// User 는 현재 세션 보유자의 신원·permissions, AdminUser 는 admin 페이지에 표시되는 다른 사용자들.
export type AdminUser = AdminUserListItemDto;
