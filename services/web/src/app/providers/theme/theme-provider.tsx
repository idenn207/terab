import { applyTheme, getStoredTheme, getSystemTheme, setStoredTheme, ThemeContext } from '@/shared/lib/theme';
import React, { useEffect, useState } from 'react';

const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState(getStoredTheme() || 'system');
  const resolvedTheme = theme === 'system' ? getSystemTheme() : theme;

  useEffect(() => {
    setStoredTheme(theme);
    applyTheme();
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>{children}</ThemeContext.Provider>;
};

export { ThemeProvider };
