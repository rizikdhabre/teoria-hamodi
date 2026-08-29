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
  const restoredThemeRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const storage = getSafeLocalStorage(
      typeof window === 'undefined' ? undefined : window,
    );
    storageRef.current = storage;

    queueMicrotask(() => {
      if (cancelled) return;
      const restored = readStoredTheme(storage);
      document.documentElement.classList.toggle('dark', restored === 'dark');
      restoredThemeRef.current = true;
      setTheme(restored);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!restoredThemeRef.current) return;
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
