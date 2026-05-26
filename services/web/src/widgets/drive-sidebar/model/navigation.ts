import { Cog6ToothIcon, HomeIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { ComponentType, SVGProps } from 'react';

interface NavigationItem {
  name: string;
  href: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const DRIVE_NAV_ITEMS: readonly NavigationItem[] = [
  { name: '내 드라이브', href: '/drive', icon: HomeIcon },
  { name: '휴지통', href: '/trash', icon: TrashIcon },
  { name: '설정', href: '/settings', icon: Cog6ToothIcon },
] as const;

export { DRIVE_NAV_ITEMS };
export type { NavigationItem };
