import type { File as DomainFile } from '@/entities/file';
import { useCallback, useEffect, useState } from 'react';

import { useSearchParams } from 'react-router-dom';
import { useFileSearchQuery, type FileSearchScope } from '../api/query';

const DEBOUNCE_MS = 200;
const MIN_QUERY_LENGTH = 2;

interface UseFileSearchProps {
  folderId: string | null;
}

interface UseFileSearchResult {
  value: string;
  setValue: (v: string) => void;
  scope: FileSearchScope;
  setScope: (s: FileSearchScope) => void;
  debouncedQ: string;
  isSearching: boolean;
  files: DomainFile[];
  isLoading: boolean;
  isFetching: boolean;
  clear: () => void;
  flush: () => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
}

function readScope(raw: string | null): FileSearchScope {
  return raw === 'folder' ? 'folder' : 'all';
}

export function useFileSearch({ folderId }: UseFileSearchProps): UseFileSearchResult {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQ = searchParams.get('q') ?? '';
  const urlScope = readScope(searchParams.get('scope'));

  const [value, setValue] = useState(urlQ);
  const [scope, setScope] = useState<FileSearchScope>(urlScope);
  const [isComposing, setIsComposing] = useState(false);

  // URL 외부 변경(popstate, 공유 링크) → local 동기화. setState during render 패턴 — React 가 추가 렌더 없이 흡수
  const [lastUrlQ, setLastUrlQ] = useState(urlQ);
  if (urlQ !== lastUrlQ) {
    setLastUrlQ(urlQ);
    setValue(urlQ);
  }
  const [lastUrlScope, setLastUrlScope] = useState(urlScope);
  if (urlScope !== lastUrlScope) {
    setLastUrlScope(urlScope);
    setScope(urlScope);
  }

  // local value/scope → URL 동기화. IME 조합 중에는 발화 안 함
  useEffect(() => {
    if (isComposing) return;
    if (value === urlQ && scope === urlScope) return;

    const handler = setTimeout(() => {
      const next = new URLSearchParams(searchParams);
      if (value.trim().length >= MIN_QUERY_LENGTH) {
        next.set('q', value);
        next.set('scope', scope);
      } else {
        next.delete('q');
        next.delete('scope');
      }
      setSearchParams(next, { replace: true });
    }, DEBOUNCE_MS);

    return () => clearTimeout(handler);
  }, [value, scope, isComposing, urlQ, urlScope, searchParams, setSearchParams]);

  const clear = useCallback(() => {
    setValue('');
    setScope('all');
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    next.delete('scope');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const flush = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    if (value.trim().length >= MIN_QUERY_LENGTH) {
      next.set('q', value);
      next.set('scope', scope);
    } else {
      next.delete('q');
      next.delete('scope');
    }
    setSearchParams(next, { replace: true });
  }, [value, scope, searchParams, setSearchParams]);

  const onCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  const onCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, []);

  const { data, isLoading, isFetching } = useFileSearchQuery({ q: urlQ, scope: urlScope, folderId });

  return {
    value,
    setValue,
    scope,
    setScope,
    debouncedQ: urlQ,
    isSearching: urlQ.trim().length >= MIN_QUERY_LENGTH,
    files: data?.files ?? [],
    isLoading,
    isFetching,
    clear,
    flush,
    onCompositionStart,
    onCompositionEnd,
  };
}
