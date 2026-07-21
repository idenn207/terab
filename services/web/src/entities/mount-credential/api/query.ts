import { mountCredentialControllerListOptions } from '@shared/api';
import { useQuery } from '@tanstack/react-query';

export function useMountCredentialListQuery() {
  return useQuery({ ...mountCredentialControllerListOptions() });
}
