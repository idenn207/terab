import { applyTheme, getStoredTheme, getSystemTheme, setStoredTheme, ThemeContext } from '@/shared/lib/theme';
import React, { useEffect, useState } from 'react';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState(getStoredTheme() || 'system');
  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;

  useEffect(() => {
    setStoredTheme(theme);
    applyTheme();
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>{children}</ThemeContext.Provider>;
}
