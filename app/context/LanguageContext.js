'use client';

import { createContext, useContext, useState,useEffect } from 'react';
import { useRouter } from 'next/navigation';

const LanguageContext = createContext(null);

export function LanguageProvider({ children, initialLang }) {
  const router = useRouter();
  const [lang, setLang] = useState(initialLang); // hydrated from server render

  useEffect(() => {
    setLang(initialLang);
  }, [initialLang]);
  function changeLang(code) {
    // 1️⃣ Set cookie FIRST (middleware reads this)
    document.cookie = `lang=${code}; path=/; max-age=31536000; SameSite=Lax`;

    // 2️⃣ Update client state (UI only)
    setLang(code);

    // 3️⃣ Force new request → middleware → server layout
    router.refresh();
  }

  return (
    <LanguageContext.Provider value={{ lang, changeLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
  return ctx;
}
