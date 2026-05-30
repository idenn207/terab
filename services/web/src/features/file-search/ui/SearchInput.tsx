import { cn } from '@/shared/lib';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useFileSearch } from '../model/useFileSearch';

interface SearchInputProps {
  folderId: string | null;
}

export function SearchInput({ folderId }: SearchInputProps) {
  const { value, setValue, scope, setScope, clear, flush, onCompositionStart, onCompositionEnd } = useFileSearch({ folderId });

  const hasValue = value.length > 0;
  const folderScopeDisabled = folderId === null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      clear();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      flush();
    }
  };

  return (
    <div role="search" aria-label="파일 검색" className="flex w-full flex-col gap-2 md:flex-row md:items-center">
      <div className="relative flex-1">
        <MagnifyingGlassIcon aria-hidden="true" className="text-text-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2" />
        <input
          role="searchbox"
          aria-label="파일 검색"
          inputMode="search"
          placeholder="파일 검색 (2자 이상)"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onCompositionStart={onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          onKeyDown={handleKeyDown}
          className={cn(
            'bg-surface-muted text-text placeholder:text-text-subtle border-border min-h-12 w-full rounded-md border pr-12 pl-10 text-base',
            'focus-visible:ring-accent focus-visible:ring-offset-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          )}
        />
        {hasValue && (
          <button
            type="button"
            aria-label="검색어 지우기"
            onClick={clear}
            className={cn(
              'text-text-muted hover:text-text absolute top-1/2 right-2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-md',
              'focus-visible:ring-accent focus:outline-none focus-visible:ring-2',
            )}
          >
            <XMarkIcon aria-hidden="true" className="size-5" />
          </button>
        )}
      </div>
      <div role="group" aria-label="검색 범위" className="flex shrink-0 gap-2">
        <ScopeButton active={scope === 'all'} onClick={() => setScope('all')}>
          전체
        </ScopeButton>
        <ScopeButton
          active={scope === 'folder'}
          disabled={folderScopeDisabled}
          title={folderScopeDisabled ? '폴더 안에서만 사용 가능' : undefined}
          onClick={() => setScope('folder')}
        >
          이 폴더
        </ScopeButton>
      </div>
    </div>
  );
}

interface ScopeButtonProps {
  active: boolean;
  disabled?: boolean;
  title?: string;
  onClick: () => void;
  children: React.ReactNode;
}

function ScopeButton({ active, disabled, title, onClick, children }: ScopeButtonProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={cn(
        'min-h-12 rounded-md border px-4 text-sm font-medium transition-colors',
        'focus-visible:ring-accent focus-visible:ring-offset-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        active && 'bg-accent text-accent-fg border-accent',
        !active && 'bg-surface text-text border-border hover:bg-surface-muted',
        disabled && 'hover:bg-surface cursor-not-allowed opacity-50',
      )}
    >
      {children}
    </button>
  );
}
