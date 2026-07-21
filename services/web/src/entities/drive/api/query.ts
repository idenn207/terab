import { driveControllerGetMyDriveOptions } from '@shared/api';
import { useQuery } from '@tanstack/react-query';

export function useMyDriveQuery() {
  return useQuery({ ...driveControllerGetMyDriveOptions() });
}
