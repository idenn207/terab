import type { Folder } from '@/entities/folder';
import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

export interface BreadcrumbItem {
  id: string;
  name: string;
}

export interface UseBreadcrumbTrailResult {
  trail: BreadcrumbItem[];
  currentFolderId: string | null;
  openFolder: (folder: Pick<Folder, 'id' | 'name'>) => void;
  navigateRoot: () => void;
  navigateToAncestor: (depth: number) => void;
}

const FOLDER_ID_PARAM = 'folderId';

export function useBreadcrumbTrail(): UseBreadcrumbTrailResult {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const currentFolderId = searchParams.get(FOLDER_ID_PARAM);
  const stateTrail = (location.state as { trail?: BreadcrumbItem[] } | null)?.trail ?? [];
  // URL이 진실의 출처 — folderId 가 없으면 trail 도 무효화
  const trail = currentFolderId ? stateTrail : [];

  const openFolder = useCallback(
    (folder: Pick<Folder, 'id' | 'name'>) => {
      const nextTrail = [...trail, { id: folder.id, name: folder.name }];
      navigate(`?${FOLDER_ID_PARAM}=${folder.id}`, { state: { trail: nextTrail } });
    },
    [trail, navigate],
  );

  const navigateRoot = useCallback(() => {
    navigate('?', { state: { trail: [] } });
  }, [navigate]);

  const navigateToAncestor = useCallback(
    (depth: number) => {
      if (depth < 0 || depth >= trail.length) return;
      const trimmed = trail.slice(0, depth + 1);
      const target = trimmed[trimmed.length - 1];
      navigate(`?${FOLDER_ID_PARAM}=${target.id}`, { state: { trail: trimmed } });
    },
    [trail, navigate],
  );

  return { trail, currentFolderId, openFolder, navigateRoot, navigateToAncestor };
}
