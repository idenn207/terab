import { userControllerMeOptions } from '@shared/api';
import { useQuery } from '@tanstack/react-query';

export function useMeQuery() {
  return useQuery({
    ...userControllerMeOptions(),
    staleTime: 1000 * 60 * 5,
  });
}
