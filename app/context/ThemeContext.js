'use client';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_THEME,
  getSafeLocalStorage,
  readStoredTheme,
  toggleThemeValue,
  writeStoredTheme,
} from '../../lib/themeStorage.mjs';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const storageRef = useRef(null);
  const skippedInitialPersistence = useRef(false);

  useEffect(() => {
    const storage = getSafeLocalStorage(
      typeof window === 'undefined' ? undefined : window,
    );
    storageRef.current = storage;
    const restored = readStoredTheme(storage);
    setTheme(restored);
    document.documentElement.classList.toggle('dark', restored === 'dark');
  }, []);

  useEffect(() => {
    if (!skippedInitialPersistence.current) {
      skippedInitialPersistence.current = true;
      return;
    }
    document.documentElement.classList.toggle('dark', theme === 'dark');
    writeStoredTheme(storageRef.current, theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => toggleThemeValue(prev));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
