import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getSafeLocalStorage,
  readStoredTheme,
  writeStoredTheme,
  removeStoredTheme,
  toggleThemeValue,
} from '../lib/themeStorage.mjs';

test('uses dark when browser storage is unavailable', () => {
  assert.equal(getSafeLocalStorage(undefined), null);
  assert.equal(readStoredTheme(null), 'dark');
});

test('contains a throwing localStorage property getter', () => {
  const browser = {};
  Object.defineProperty(browser, 'localStorage', {
    get() {
      throw new DOMException('blocked', 'SecurityError');
    },
  });
  assert.equal(getSafeLocalStorage(browser), null);
});

test('contains throwing and missing storage methods', () => {
  assert.equal(readStoredTheme({}), 'dark');
  assert.equal(
    readStoredTheme({ getItem() { throw new DOMException('blocked', 'SecurityError'); } }),
    'dark',
  );
  assert.equal(
    writeStoredTheme({ setItem() { throw new DOMException('full', 'QuotaExceededError'); } }, 'light'),
    false,
  );
  assert.equal(removeStoredTheme({ removeItem() { throw new Error('blocked'); } }), false);
});

test('preserves valid values and in-memory toggling after persistence failure', () => {
  assert.equal(readStoredTheme({ getItem: () => 'light' }), 'light');
  assert.equal(readStoredTheme({ getItem: () => 'unexpected' }), 'dark');
  const storage = { setItem() { throw new Error('full'); } };
  let theme = toggleThemeValue('dark');
  assert.equal(theme, 'light');
  assert.equal(writeStoredTheme(storage, theme), false);
  theme = toggleThemeValue(theme);
  assert.equal(theme, 'dark');
});
