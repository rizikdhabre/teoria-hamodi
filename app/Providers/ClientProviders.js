'use client';

import { SessionProvider } from 'next-auth/react';
import { LanguageProvider } from '../context/LanguageContext';
import { TranslationProvider } from '../context/TranslationContext';

export default function ClientProviders({ children, lang }) {
  return (
    <SessionProvider>
      <LanguageProvider initialLang={lang}>
        <TranslationProvider>{children}</TranslationProvider>
      </LanguageProvider>
    </SessionProvider>
  );
}
