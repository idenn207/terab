import { useFileSearch } from '@/features';
import { DriveBreadcrumb, DriveMountPanel, FileList, FileToolbar, useBreadcrumbTrail } from '@/widgets';

export function DrivePage() {
  const { currentFolderId, openFolder } = useBreadcrumbTrail();
  const { isSearching, files: searchFiles, isLoading: isSearchLoading, debouncedQ } = useFileSearch({ folderId: currentFolderId });

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8 lg:py-6">
      <section data-region="main" aria-label="드라이브 콘텐츠" className="flex flex-col gap-6">
        {isSearching ? (
          <p data-testid="search-result-banner" className="text-text-muted text-sm">
            '{debouncedQ}' 검색 결과
          </p>
        ) : (
          <DriveBreadcrumb />
        )}
        <FileToolbar folderId={currentFolderId} />
        {isSearching ? (
          <FileList mode="search" files={searchFiles} isLoading={isSearchLoading} />
        ) : (
          <FileList folderId={currentFolderId} onFolderOpen={openFolder} />
        )}
        {!isSearching && <DriveMountPanel />}
      </section>
      <aside
        data-region="secondary"
        aria-label="보조 콘텐츠"
        className="fixed top-16 bottom-0 left-20 hidden w-96 overflow-y-auto border-r border-gray-200 px-4 py-6 sm:px-6 lg:px-8 xl:block dark:border-white/10"
      />
    </div>
  );
}
