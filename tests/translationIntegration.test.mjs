import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('the active provider tree uses React registration and has no DOM translation manager', () => {
  const provider = read('app/context/TranslationContext.js');
  const clientProviders = read('app/Providers/ClientProviders.js');
  const language = read('app/context/LanguageContext.js');
  const layout = read('app/layout.js');
  const activeSource = [provider, clientProviders, language, layout].join('\n');

  assert.match(provider, /export function TranslationProvider/);
  assert.match(provider, /export function useTranslationStrings/);
  assert.match(provider, /fetch\(['"]\/api\/translate['"]/);
  assert.match(provider, /AbortController/);
  assert.match(clientProviders, /<TranslationProvider>/);
  assert.doesNotMatch(clientProviders, /TranslationManager/);
  assert.doesNotMatch(language, /useRouter|router\.refresh/);
  assert.match(language, /value=\{\{ lang, dir, changeLang \}\}/);
  assert.doesNotMatch(layout, /style\.visibility|visibility = 'hidden'/);
  assert.equal(existsSync(new URL('../components/TranslationManager.js', import.meta.url)), false);
  assert.doesNotMatch(activeSource, /createTreeWalker|MutationObserver|nodeValue/);
});
