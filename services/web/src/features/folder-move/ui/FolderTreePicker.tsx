import type { Folder } from '@/entities/folder';
import { useFolderChildrenQuery, useFolderRootQuery } from '@/entities/folder';
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

interface FolderTreePickerProps {
  excludedFolderId: string;
  selectedParentId: string | null;
  onSelect: (parentId: string | null) => void;
}

export function FolderTreePicker({ excludedFolderId, selectedParentId, onSelect }: FolderTreePickerProps) {
  const root = useFolderRootQuery();

  return (
    <div className="rounded-md border border-zinc-200 p-2 dark:border-white/10">
      <ul role="tree" aria-label="이동 대상 폴더" className="flex flex-col gap-1">
        <li role="treeitem" aria-selected={selectedParentId === null}>
          <button
            type="button"
            onClick={() => onSelect(null)}
            aria-pressed={selectedParentId === null}
            className={
              selectedParentId === null
                ? 'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
                : 'flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800'
            }
          >
            루트
          </button>
        </li>
        {root.isLoading && (
          <li role="treeitem" aria-busy="true" className="px-2 py-1 text-xs text-zinc-500">
            불러오는 중...
          </li>
        )}
        {root.data?.folders.map((folder) => (
          <FolderTreeNode
            key={folder.id}
            folder={folder}
            depth={1}
            excludedFolderId={excludedFolderId}
            selectedParentId={selectedParentId}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </div>
  );
}

interface FolderTreeNodeProps {
  folder: Folder;
  depth: number;
  excludedFolderId: string;
  selectedParentId: string | null;
  onSelect: (parentId: string | null) => void;
}

function FolderTreeNode({ folder, depth, excludedFolderId, selectedParentId, onSelect }: FolderTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const children = useFolderChildrenQuery(isExpanded ? folder.id : undefined);
  const isExcluded = folder.id === excludedFolderId;
  const isSelected = selectedParentId === folder.id;

  const buttonClass = isExcluded
    ? 'flex flex-1 items-center gap-2 rounded px-2 py-1 text-left text-sm text-zinc-400 cursor-not-allowed dark:text-zinc-600'
    : isSelected
      ? 'flex flex-1 items-center gap-2 rounded px-2 py-1 text-left text-sm bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
      : 'flex flex-1 items-center gap-2 rounded px-2 py-1 text-left text-sm text-zinc-800 hover:bg-zinc-100 dark:text-zinc-100 dark:hover:bg-zinc-800';

  return (
    <li role="treeitem" aria-selected={isSelected} aria-expanded={isExpanded} aria-disabled={isExcluded}>
      <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 16}px` }}>
        <button
          type="button"
          aria-label={isExpanded ? `${folder.name} 접기` : `${folder.name} 펴기`}
          onClick={() => setIsExpanded((prev) => !prev)}
          disabled={isExcluded}
          className="-m-1 rounded p-1 text-zinc-500 disabled:opacity-30 disabled:cursor-not-allowed hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          {isExpanded ? (
            <ChevronDownIcon aria-hidden="true" className="size-4" />
          ) : (
            <ChevronRightIcon aria-hidden="true" className="size-4" />
          )}
        </button>
        <button type="button" onClick={() => !isExcluded && onSelect(folder.id)} disabled={isExcluded} className={buttonClass}>
          {folder.name}
        </button>
      </div>
      {isExpanded && (
        <ul role="group" className="flex flex-col gap-1">
          {children.isLoading && (
            <li role="treeitem" aria-busy="true" className="px-2 py-1 text-xs text-zinc-500" style={{ paddingLeft: `${(depth + 1) * 16}px` }}>
              불러오는 중...
            </li>
          )}
          {children.data?.folders.map((child) => (
            <FolderTreeNode
              key={child.id}
              folder={child}
              depth={depth + 1}
              excludedFolderId={excludedFolderId}
              selectedParentId={selectedParentId}
              onSelect={onSelect}
            />
          ))}
        </ul>
      )}
    </li>
  );
}
