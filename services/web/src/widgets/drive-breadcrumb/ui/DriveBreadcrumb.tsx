import * as Headless from '@headlessui/react';
import { HomeIcon } from '@heroicons/react/24/outline';
import { ChevronRightIcon } from '@heroicons/react/16/solid';
import { EllipsisHorizontalIcon } from '@heroicons/react/24/outline';
import { useBreadcrumbTrail } from '../model/useBreadcrumbTrail';

const VISIBLE_TAIL_COUNT = 2;

type RootItem = { kind: 'root' };
type AncestorItem = { kind: 'ancestor'; folder: { id: string; name: string }; trailIndex: number };
type BreadcrumbItem = RootItem | AncestorItem;

export function DriveBreadcrumb() {
  const { trail, currentFolderId, navigateRoot, navigateToAncestor } = useBreadcrumbTrail();
  const isRoot = currentFolderId === null;
  const fallbackHasLostTrail = !isRoot && trail.length === 0;

  const items: BreadcrumbItem[] = [
    { kind: 'root' },
    ...trail.map((folder, trailIndex) => ({ kind: 'ancestor' as const, folder, trailIndex })),
  ];
  const shouldCollapse = items.length > VISIBLE_TAIL_COUNT;
  const hidden = shouldCollapse ? items.slice(0, -VISIBLE_TAIL_COUNT) : [];
  const visible = shouldCollapse ? items.slice(-VISIBLE_TAIL_COUNT) : items;

  return (
    <nav aria-label="경로" className="flex">
      <ol role="list" className="flex flex-wrap items-center gap-1 text-sm">
        {shouldCollapse ? (
          <BreadcrumbEllipsisMenu hidden={hidden} navigateRoot={navigateRoot} navigateToAncestor={navigateToAncestor} />
        ) : (
          <BreadcrumbRoot isRoot={isRoot} navigateRoot={navigateRoot} />
        )}

        {fallbackHasLostTrail && !shouldCollapse && (
          <>
            <ChevronRightIcon aria-hidden="true" className="size-4 text-zinc-400" />
            <li
              aria-current="page"
              className="px-2 py-1 text-zinc-500 dark:text-zinc-400"
              title="새로고침으로 경로 정보가 사라졌습니다. 루트로 돌아가 다시 진입해주세요."
            >
              현재 폴더
            </li>
          </>
        )}

        {visible.map((item) => {
          if (item.kind === 'root') {
            return null;
          }
          const isCurrent = item.trailIndex === trail.length - 1;
          return (
            <li key={item.folder.id} className="flex items-center gap-1">
              <ChevronRightIcon aria-hidden="true" className="size-4 text-zinc-400" />
              {isCurrent ? (
                <span aria-current="page" className="px-2 py-1 font-medium text-zinc-900 dark:text-zinc-100">
                  {item.folder.name}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => navigateToAncestor(item.trailIndex)}
                  className="rounded px-2 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  {item.folder.name}
                </button>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function BreadcrumbRoot({ isRoot, navigateRoot }: { isRoot: boolean; navigateRoot: () => void }) {
  return (
    <li>
      <button
        type="button"
        onClick={navigateRoot}
        aria-current={isRoot ? 'page' : undefined}
        className={
          isRoot
            ? 'flex items-center gap-1 rounded px-2 py-1 font-medium text-zinc-900 dark:text-zinc-100'
            : 'flex items-center gap-1 rounded px-2 py-1 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-100'
        }
      >
        <HomeIcon aria-hidden="true" className="size-4" />
        <span>루트</span>
      </button>
    </li>
  );
}

interface BreadcrumbEllipsisMenuProps {
  hidden: BreadcrumbItem[];
  navigateRoot: () => void;
  navigateToAncestor: (index: number) => void;
}

function BreadcrumbEllipsisMenu({ hidden, navigateRoot, navigateToAncestor }: BreadcrumbEllipsisMenuProps) {
  return (
    <li>
      <Headless.Menu as="div" className="relative">
        <Headless.MenuButton
          aria-label="상위 경로 펼치기"
          className="-m-1 flex items-center rounded p-1 text-zinc-500 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <EllipsisHorizontalIcon aria-hidden="true" className="size-5" />
        </Headless.MenuButton>
        <Headless.MenuItems
          transition
          anchor="bottom start"
          className="z-10 mt-2 min-w-40 origin-top-left rounded-md bg-white py-2 shadow-lg outline outline-gray-900/5 transition data-closed:scale-95 data-closed:transform data-closed:opacity-0 data-enter:duration-100 data-enter:ease-out data-leave:duration-75 data-leave:ease-in dark:bg-gray-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10"
        >
          {hidden.map((item) =>
            item.kind === 'root' ? (
              <Headless.MenuItem key="__root__">
                <button
                  type="button"
                  onClick={navigateRoot}
                  className="flex w-full items-center gap-2 px-3 py-1 text-left text-sm/6 text-gray-900 data-focus:bg-gray-50 data-focus:outline-hidden dark:text-white dark:data-focus:bg-white/5"
                >
                  <HomeIcon aria-hidden="true" className="size-4" />
                  <span>루트</span>
                </button>
              </Headless.MenuItem>
            ) : (
              <Headless.MenuItem key={item.folder.id}>
                <button
                  type="button"
                  onClick={() => navigateToAncestor(item.trailIndex)}
                  className="block w-full px-3 py-1 text-left text-sm/6 text-gray-900 data-focus:bg-gray-50 data-focus:outline-hidden dark:text-white dark:data-focus:bg-white/5"
                >
                  {item.folder.name}
                </button>
              </Headless.MenuItem>
            ),
          )}
        </Headless.MenuItems>
      </Headless.Menu>
    </li>
  );
}
