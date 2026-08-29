export const DEFAULT_THEME = 'dark';
const VALID_THEMES = new Set(['dark', 'light']);

export function getSafeLocalStorage(browser) {
  if (!browser) return null;
  try {
    return browser.localStorage || null;
  } catch {
    return null;
  }
}

export function readStoredTheme(storage) {
  try {
    if (typeof storage?.getItem !== 'function') return DEFAULT_THEME;
    const value = storage.getItem('theme');
    return VALID_THEMES.has(value) ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function writeStoredTheme(storage, theme) {
  try {
    if (typeof storage?.setItem !== 'function') return false;
    storage.setItem('theme', VALID_THEMES.has(theme) ? theme : DEFAULT_THEME);
    return true;
  } catch {
    return false;
  }
}

export function removeStoredTheme(storage) {
  try {
    if (typeof storage?.removeItem !== 'function') return false;
    storage.removeItem('theme');
    return true;
  } catch {
    return false;
  }
}

export function toggleThemeValue(theme) {
  return theme === 'dark' ? 'light' : 'dark';
}
