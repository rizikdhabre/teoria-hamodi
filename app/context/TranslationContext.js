'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { usePathname } from 'next/navigation';
import { createTranslationState } from '../../lib/translationState.mjs';
import { useLanguage } from './LanguageContext';

const TranslationContext = createContext(null);
const BATCH_DELAY_MS = 120;

function dedupeExactSources(sources) {
  const seen = new Set();
  return (Array.isArray(sources) ? sources : []).filter((source) => {
    if (typeof source !== 'string' || seen.has(source)) return false;
    seen.add(source);
    return true;
  });
}

export function TranslationProvider({ children }) {
  const pathname = usePathname();
  const { lang } = useLanguage();
  const stateRef = useRef(null);
  const [version, setVersion] = useState(0);
  if (!stateRef.current) stateRef.current = createTranslationState();

  const publish = useCallback(() => setVersion((version) => version + 1), []);

  const register = useCallback((id, sources) => {
    const state = stateRef.current;
    if (!state.register(id, sources)) return;
    state.invalidate();
    publish();
  }, [publish]);

  const unregister = useCallback((id) => {
    const state = stateRef.current;
    if (!state.unregister(id)) return;
    state.invalidate();
    publish();
  }, [publish]);

  useEffect(() => {
    if (stateRef.current.setScope(pathname, lang)) publish();
  }, [lang, pathname, publish]);

  useEffect(() => {
    const state = stateRef.current;
    const request = state.createRequest();
    if (!request) return undefined;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pageId: request.pageId,
            targetLang: request.targetLang,
            texts: request.sources,
          }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Translation request failed');
        const data = await response.json();
        if (state.applyResponse(request, data?.translatedTexts)) publish();
        else if (state.markFailed(request)) publish();
      } catch (error) {
        if (!controller.signal.aborted && state.markFailed(request)) publish();
      }
    }, BATCH_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
      state.invalidateRequest(request);
    };
  }, [lang, pathname, publish, version]);

  const translate = useCallback(
    (source) => stateRef.current.translate(source, pathname, lang),
    [lang, pathname, version],
  );

  const value = useMemo(() => ({ register, unregister, translate }), [register, translate, unregister]);
  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function useTranslationStrings(hebrewSources) {
  const context = useContext(TranslationContext);
  if (!context) throw new Error('useTranslationStrings must be used inside TranslationProvider');
  const registrationId = useId();
  const signature = JSON.stringify(dedupeExactSources(hebrewSources));

  useEffect(() => {
    context.register(registrationId, JSON.parse(signature));
  }, [
    context.register,
    registrationId,
    signature,
  ]);

  useEffect(() => () => context.unregister(registrationId), [
    context.unregister,
    registrationId,
  ]);

  return context.translate;
}
