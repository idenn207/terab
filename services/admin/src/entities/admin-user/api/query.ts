import { type ListUsersQueryDto, userAdminControllerListOptions } from '@shared/api';
import { useQuery } from '@tanstack/react-query';

export function useAdminUserListQuery(query?: ListUsersQueryDto) {
  return useQuery({
    ...userAdminControllerListOptions(query ? { query } : undefined),
  });
}
