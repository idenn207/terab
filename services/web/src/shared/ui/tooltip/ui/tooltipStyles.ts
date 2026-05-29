// Material Tooltip 토큰 utility — 단순 fixed positioning, 별도 floating lib 없음
export const tooltipContentClass = [
  'pointer-events-none absolute z-50',
  'rounded-sm bg-text px-2 py-1 text-xs text-surface',
  'shadow-md',
  'transition-opacity duration-fast ease-out',
].join(' ');
