const LANGUAGE_META = Object.freeze({
  HE: Object.freeze({ code: 'HE', htmlLang: 'he', dir: 'rtl', targetLang: 'Hebrew' }),
  AR: Object.freeze({ code: 'AR', htmlLang: 'ar', dir: 'rtl', targetLang: 'Arabic' }),
  EN: Object.freeze({ code: 'EN', htmlLang: 'en', dir: 'ltr', targetLang: 'English' }),
});

export function normalizeLanguage(code) {
  return typeof code === 'string' && LANGUAGE_META[code] ? code : 'HE';
}

export function getLanguageMeta(code) {
  return LANGUAGE_META[normalizeLanguage(code)];
}
