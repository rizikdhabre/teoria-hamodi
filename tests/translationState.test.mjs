import test from 'node:test';
import assert from 'node:assert/strict';
import { getLanguageMeta } from '../lib/language.mjs';
import { createTranslationState } from '../lib/translationState.mjs';

function deferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

test('deduplicates the union and cleans up registrations', () => {
  const state = createTranslationState();
  state.register('header', ['בית', 'צור קשר']);
  state.register('page', ['בית', 'אודות']);
  assert.deepEqual(state.getActiveSources(), ['בית', 'צור קשר', 'אודות']);
  state.unregister('header');
  assert.deepEqual(state.getActiveSources(), ['בית', 'אודות']);
});

test('maps a captured source snapshot rather than current registration order', () => {
  const state = createTranslationState();
  state.setScope('/about', 'EN');
  state.register('page', ['בית', 'אודות']);
  const request = state.createRequest();
  state.unregister('page');
  state.register('page', ['אודות', 'בית', 'חדש']);
  assert.equal(state.applyResponse(request, ['Home', 'About']), true);
  assert.equal(state.translate('בית', '/about', 'EN'), 'Home');
  assert.equal(state.translate('אודות', '/about', 'EN'), 'About');
  assert.equal(state.translate('חדש', '/about', 'EN'), 'חדש');
});

test('rejects stale language and pathname responses', () => {
  const state = createTranslationState();
  state.register('page', ['בית']);
  state.setScope('/', 'EN');
  const oldLanguage = state.createRequest();
  state.setScope('/', 'AR');
  assert.equal(state.applyResponse(oldLanguage, ['Home']), false);
  const oldPath = state.createRequest();
  state.setScope('/about', 'AR');
  assert.equal(state.applyResponse(oldPath, ['الرئيسية']), false);
});

test('Hebrew skips requests and pending or failed translations fall back to Hebrew', () => {
  const state = createTranslationState();
  state.register('page', ['בית']);
  state.setScope('/', 'HE');
  assert.equal(state.createRequest(), null);
  assert.equal(state.translate('בית', '/', 'HE'), 'בית');
  state.setScope('/', 'EN');
  assert.equal(state.translate('בית', '/', 'EN'), 'בית');
  state.markFailed(state.createRequest());
  assert.equal(state.createRequest(), null);
  assert.equal(state.translate('בית', '/', 'EN'), 'בית');
});

test('a failed source stays failed when its registration updates and only a new source is requested', () => {
  const state = createTranslationState();
  state.setScope('/', 'EN');
  state.register('page', ['א']);
  state.markFailed(state.createRequest());

  state.unregister('page');
  state.register('page', ['ב', 'א']);

  assert.deepEqual(state.createRequest().sources, ['ב']);
});

test('a language transition retains failures for registrations created in Hebrew and requests only a new source', () => {
  const state = createTranslationState();
  state.register('page', ['כותרת', 'תיאור']);
  state.setScope('/lesson', 'EN');
  const failedRequest = state.createRequest();
  assert.deepEqual(failedRequest.sources, ['כותרת', 'תיאור']);
  assert.equal(state.markFailed(failedRequest), true);

  state.unregister('page');
  state.register('page', ['תיאור', 'חדש', 'כותרת']);

  assert.deepEqual(state.createRequest().sources, ['חדש']);
  assert.equal(state.translate('כותרת', '/lesson', 'EN'), 'כותרת');
  assert.equal(state.translate('תיאור', '/lesson', 'EN'), 'תיאור');
});

test('a pathname transition retains failures for existing registrations after growth and reorder', () => {
  const state = createTranslationState();
  state.setScope('/catalog', 'EN');
  state.register('page', ['מוצר', 'מחיר']);
  state.setScope('/details', 'EN');
  const failedRequest = state.createRequest();
  assert.deepEqual(failedRequest.sources, ['מוצר', 'מחיר']);
  assert.equal(state.markFailed(failedRequest), true);

  state.register('page', ['מחיר', 'זמינות', 'מוצר']);

  assert.deepEqual(state.createRequest().sources, ['זמינות']);
  assert.equal(state.translate('מוצר', '/details', 'EN'), 'מוצר');
  assert.equal(state.translate('מחיר', '/details', 'EN'), 'מחיר');
});

test('language metadata is RTL for HE/AR and LTR for EN', () => {
  assert.deepEqual(getLanguageMeta('HE'), { code: 'HE', htmlLang: 'he', dir: 'rtl', targetLang: 'Hebrew' });
  assert.equal(getLanguageMeta('AR').dir, 'rtl');
  assert.equal(getLanguageMeta('EN').dir, 'ltr');
});

test('a successful batch leaves only newly registered sources to request', () => {
  const state = createTranslationState();
  state.setScope('/', 'EN');
  state.register('header', ['בית']);
  const initial = state.createRequest();
  assert.equal(state.applyResponse(initial, ['Home']), true);
  state.register('page', ['בית', 'אודות']);
  assert.deepEqual(state.createRequest().sources, ['אודות']);
});

test('rejects malformed and misaligned responses without translating', () => {
  const state = createTranslationState();
  state.setScope('/', 'EN');
  state.register('page', ['בית', 'אודות']);
  const request = state.createRequest();
  assert.equal(state.applyResponse(request, 'not an array'), false);
  assert.equal(state.applyResponse(request, ['Home']), false);
  assert.equal(state.applyResponse(request, ['Home', '']), false);
  assert.equal(state.translate('בית', '/', 'EN'), 'בית');
});

test('a newer request makes the older response stale', () => {
  const state = createTranslationState();
  state.setScope('/', 'EN');
  state.register('page', ['בית']);
  const older = state.createRequest();
  const newer = state.createRequest();
  assert.equal(state.applyResponse(older, ['Old home']), false);
  assert.equal(state.applyResponse(newer, ['Home']), true);
  assert.equal(state.translate('בית', '/', 'EN'), 'Home');
});

test('a response that resolves after a scope change cannot overwrite the new scope', async () => {
  const state = createTranslationState();
  const response = deferred();
  state.register('page', ['בית']);
  state.setScope('/', 'EN');
  const englishRequest = state.createRequest();
  state.setScope('/', 'AR');
  const arabicRequest = state.createRequest();
  response.resolve(['Home']);
  assert.equal(state.applyResponse(englishRequest, await response.promise), false);
  assert.equal(state.applyResponse(arabicRequest, ['الرئيسية']), true);
  assert.equal(state.translate('בית', '/', 'AR'), 'الرئيسية');
});

test('exact source strings remain distinct when registrations change order', () => {
  const state = createTranslationState();
  state.setScope('/', 'EN');
  state.register('first', ['בית', 'בית ']);
  const request = state.createRequest();
  state.unregister('first');
  state.register('second', ['בית ', 'בית']);
  assert.equal(state.applyResponse(request, ['Home', 'Home with space']), true);
  assert.equal(state.translate('בית', '/', 'EN'), 'Home');
  assert.equal(state.translate('בית ', '/', 'EN'), 'Home with space');
});
