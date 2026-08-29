import { getLanguageMeta, normalizeLanguage } from './language.mjs';

const scopeKey = (pathname, language) => JSON.stringify([pathname, language]);

function activeSources(registrations) {
  const seen = new Set();
  const sources = [];
  for (const registration of registrations.values()) {
    for (const source of registration) {
      if (!seen.has(source)) {
        seen.add(source);
        sources.push(source);
      }
    }
  }
  return sources;
}

function exactSources(sources) {
  return new Set(Array.isArray(sources)
    ? sources.filter((source) => typeof source === 'string')
    : []);
}

export function createTranslationState() {
  const registrations = new Map();
  const translations = new Map();
  const failures = new Map();
  const registeredSources = new Map();
  let pathname = '/';
  let language = 'HE';
  let generation = 0;
  let nextRequestId = 0;
  let activeRequestId = null;

  function currentScopeKey() {
    return scopeKey(pathname, language);
  }

  function invalidate() {
    generation += 1;
    activeRequestId = null;
  }

  function register(id, sources) {
    const next = exactSources(sources);
    const previous = registrations.get(id);
    const unchanged = previous
      && previous.size === next.size
      && [...previous].every((source) => next.has(source));
    if (unchanged) return false;

    registrations.set(id, next);
    const key = currentScopeKey();
    const known = registeredSources.get(key) || new Set();
    const failed = failures.get(currentScopeKey());
    for (const source of next) {
      if (!known.has(source)) {
        known.add(source);
        failed?.delete(source);
      }
    }
    registeredSources.set(key, known);
    return true;
  }

  function unregister(id) {
    if (!registrations.has(id)) return false;
    registrations.delete(id);
    return true;
  }

  function setScope(nextPathname, nextLanguage) {
    const normalizedLanguage = normalizeLanguage(nextLanguage);
    const normalizedPathname = typeof nextPathname === 'string' ? nextPathname : '/';
    if (pathname === normalizedPathname && language === normalizedLanguage) return false;
    pathname = normalizedPathname;
    language = normalizedLanguage;
    invalidate();
    return true;
  }

  function createRequest() {
    if (language === 'HE') return null;
    const key = currentScopeKey();
    const translated = translations.get(key) || new Map();
    const failed = failures.get(key) || new Set();
    const active = activeSources(registrations);
    const known = registeredSources.get(key) || new Set();
    active.forEach((source) => known.add(source));
    registeredSources.set(key, known);
    const sources = active.filter(
      (source) => !translated.has(source) && !failed.has(source),
    );
    if (sources.length === 0) return null;

    const request = Object.freeze({
      sources: Object.freeze([...sources]),
      pageId: pathname,
      language,
      targetLang: getLanguageMeta(language).targetLang,
      generation,
      id: ++nextRequestId,
    });
    activeRequestId = request.id;
    return request;
  }

  function isCurrentRequest(request) {
    return Boolean(request)
      && request.generation === generation
      && request.id === activeRequestId
      && request.pageId === pathname
      && request.language === language;
  }

  function applyResponse(request, translatedTexts) {
    if (!isCurrentRequest(request)
      || !Array.isArray(translatedTexts)
      || translatedTexts.length !== request.sources.length
      || translatedTexts.some((text) => typeof text !== 'string' || text.trim().length === 0)) {
      return false;
    }

    const key = scopeKey(request.pageId, request.language);
    const translated = translations.get(key) || new Map();
    request.sources.forEach((source, index) => translated.set(source, translatedTexts[index]));
    translations.set(key, translated);
    activeRequestId = null;
    return true;
  }

  function markFailed(request) {
    if (!isCurrentRequest(request)) return false;
    const key = scopeKey(request.pageId, request.language);
    const failed = failures.get(key) || new Set();
    request.sources.forEach((source) => failed.add(source));
    failures.set(key, failed);
    activeRequestId = null;
    return true;
  }

  function invalidateRequest(request) {
    if (!isCurrentRequest(request)) return false;
    invalidate();
    return true;
  }

  return {
    register,
    unregister,
    setScope,
    invalidate,
    invalidateRequest,
    getActiveSources: () => activeSources(registrations),
    createRequest,
    applyResponse,
    markFailed,
    translate: (source, targetPathname, targetLanguage) => {
      const key = scopeKey(
        typeof targetPathname === 'string' ? targetPathname : '/',
        normalizeLanguage(targetLanguage),
      );
      return translations.get(key)?.get(source) || source;
    },
  };
}
