/**
 * 테마 종류
 * - light: 밝은 테마
 * - dark: 어두운 테마
 * - system: 시스템 테마
 */
export type ThemeValue = 'light' | 'dark' | 'system';

/**
 * LocalStorage 읽기
 * @returns {ThemeValue}
 */
function getStoredTheme(): Partial<ThemeValue> {
  return localStorage.theme;
}

/**
 * LocalStorage 쓰기
 * @param {ThemeValue} [theme="system"] 테마 색상
 */
function setStoredTheme(theme: ThemeValue): void {
  localStorage.theme = theme;
}

/** 사용자의 시스템 테마 감지 */
function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * 현재 테마 반영
 * @param {ThemeValue} theme 테마 색상
 */
function applyTheme() {
  document.documentElement.classList.toggle(
    'dark',
    localStorage.theme === 'dark' ||
      (localStorage.theme === 'system' && getSystemTheme() === 'dark') ||
      (!('theme' in localStorage) && getSystemTheme() === 'dark'),
  );
}

export { getStoredTheme, setStoredTheme, getSystemTheme, applyTheme };
