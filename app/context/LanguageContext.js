'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getLanguageMeta, normalizeLanguage } from '../../lib/language.mjs';

const LanguageContext = createContext(null);

export function LanguageProvider({ children, initialLang }) {
  const [lang, setLang] = useState(() => normalizeLanguage(initialLang));

  useEffect(() => {
    setLang(normalizeLanguage(initialLang));
  }, [initialLang]);

  const dir = getLanguageMeta(lang).dir;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const meta = getLanguageMeta(lang);
    document.documentElement.lang = meta.htmlLang;
    document.documentElement.dir = meta.dir;
  }, [lang]);

  function changeLang(code) {
    const normalized = normalizeLanguage(code);
    document.cookie = `lang=${normalized}; path=/; max-age=31536000; SameSite=Lax`;
    setLang(normalized);
  }

  return (
    <LanguageContext.Provider value={{ lang, dir, changeLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
