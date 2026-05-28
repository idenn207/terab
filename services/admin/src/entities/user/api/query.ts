import { authControllerMeOptions } from '@shared/api';
import { useQuery } from '@tanstack/react-query';

export function useMeQuery() {
  return useQuery({
    ...authControllerMeOptions(),
    staleTime: 1000 * 60 * 5,
  });
}
