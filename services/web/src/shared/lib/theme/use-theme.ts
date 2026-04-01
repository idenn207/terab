import { useContext } from 'react';
import { ThemeContext } from './context';

function useTheme() {
  const value = useContext(ThemeContext);
  if (!value) throw new Error('useTheme은 ThemeProvider 내부에서만 사용할 수 있습니다');
  return value;
}

export { useTheme };
