import { fileControllerSearchOptions, type FileControllerSearchData } from '@shared/api';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

export type FileSearchScope = 'all' | 'folder';

interface UseFileSearchQueryArgs {
  q: string;
  scope: FileSearchScope;
  folderId: string | null;
}

const MIN_QUERY_LENGTH = 2;

export function useFileSearchQuery({ q, scope, folderId }: UseFileSearchQueryArgs) {
  const trimmed = q.trim();
  const enabled = trimmed.length >= MIN_QUERY_LENGTH && (scope !== 'folder' || folderId !== null);

  // codegen 이 enum 을 Object 로 fallback — runtime 은 'all'|'folder' 문자열을 그대로 전송. 두 단계 cast 로 TS 경계만 우회
  const query = {
    q: trimmed,
    scope,
    ...(folderId !== null ? { folderId } : {}),
  } as unknown as FileControllerSearchData['query'];

  return useQuery({
    ...fileControllerSearchOptions({ query }),
    enabled,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}
