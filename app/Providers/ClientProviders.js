'use client';

import { SessionProvider } from 'next-auth/react';
import { LanguageProvider } from '../context/LanguageContext';
import TranslationManager from '@/components/TranslationManager';

export default function ClientProviders({ children, lang }) {
  return (
    <SessionProvider>
      <LanguageProvider initialLang={lang}>
        <TranslationManager />
        {children}
      </LanguageProvider>
    </SessionProvider>
  );
}
