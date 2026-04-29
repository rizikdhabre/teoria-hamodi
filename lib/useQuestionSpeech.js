'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';

const audioUrlCache = new Map();
const pendingAudioUrlCache = new Map();
const preloadedAudioCache = new Map();
const WAIT_MESSAGES = {
  AR: 'انتظر، نحن نعمل على ذلك. لا تستعجل!',
  HE: 'חכה, אנחנו עובדים על זה. בלי לחץ!',
  EN: "Wait, we are working on it. Don't rush!",
};

function buildAudioCacheKey({ collectionName, docId, lang, type, optionKey }) {
  return [collectionName, docId, lang, type, optionKey || ''].join(':');
}

function cacheAudioUrl(cacheKey, url) {
  if (!url) return;
  audioUrlCache.set(cacheKey, url);
}

function ensurePreloadedAudio(cacheKey, url) {
  if (!url || typeof window === 'undefined') return null;

  if (preloadedAudioCache.has(cacheKey)) {
    return preloadedAudioCache.get(cacheKey);
  }

  const audio = new Audio(url);
  audio.preload = 'auto';
  audio.load();
  preloadedAudioCache.set(cacheKey, audio);
  return audio;
}

function cacheQuestionBundle({
  collectionName,
  docId,
  lang,
  questionUrl,
  optionUrls,
}) {
  const questionCacheKey = buildAudioCacheKey({
    collectionName,
    docId,
    lang,
    type: 'question',
  });

  if (questionUrl) {
    cacheAudioUrl(questionCacheKey, questionUrl);
    ensurePreloadedAudio(questionCacheKey, questionUrl);
  }

  for (const [optionKey, url] of Object.entries(optionUrls || {})) {
    const optionCacheKey = buildAudioCacheKey({
      collectionName,
      docId,
      lang,
      type: 'option',
      optionKey,
    });

    cacheAudioUrl(optionCacheKey, url);
    ensurePreloadedAudio(optionCacheKey, url);
  }
}

export function useQuestionSpeech(lang) {
  const [speakingId, setSpeakingId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const audioRef = useRef(null);
  const statusTimeoutRef = useRef(null);
  const isSpeechSupported = lang?.toUpperCase() !== 'HE';

  useEffect(() => {
    return () => {
      if (statusTimeoutRef.current) {
        clearTimeout(statusTimeoutRef.current);
      }
    };
  }, []);

  const showPendingMessage = useCallback(() => {
    const message = WAIT_MESSAGES[lang?.toUpperCase()] || WAIT_MESSAGES.HE;

    if (statusTimeoutRef.current) {
      clearTimeout(statusTimeoutRef.current);
    }

    setStatusMessage(message);
    statusTimeoutRef.current = setTimeout(() => {
      setStatusMessage('');
      statusTimeoutRef.current = null;
    }, 2500);
  }, [lang]);

  const getAudioUrl = useCallback(async ({
    collectionName,
    docId,
    type,
    optionKey,
  }) => {
    const normalizedLang = lang.toLowerCase();
    const cacheKey = buildAudioCacheKey({
      collectionName,
      docId,
      lang: normalizedLang,
      type,
      optionKey,
    });

    if (audioUrlCache.has(cacheKey)) {
      return { cacheKey, url: audioUrlCache.get(cacheKey) };
    }

    if (pendingAudioUrlCache.has(cacheKey)) {
      try {
        const url = await pendingAudioUrlCache.get(cacheKey);

        if (url) {
          return { cacheKey, url };
        }
      } catch (error) {
        if (audioUrlCache.has(cacheKey)) {
          return { cacheKey, url: audioUrlCache.get(cacheKey) };
        }
      }
    }

    const request = axios
      .post('/api/tts', {
        collectionName,
        docId,
        lang: normalizedLang,
        type,
        optionKey,
      })
      .then((res) => {
        const url = res.data.url;
        audioUrlCache.set(cacheKey, url);
        pendingAudioUrlCache.delete(cacheKey);
        return url;
      })
      .catch((error) => {
        pendingAudioUrlCache.delete(cacheKey);
        throw error;
      });

    pendingAudioUrlCache.set(cacheKey, request);

    const url = await request;
    return { cacheKey, url };
  }, [lang]);

  const preloadQuestionBundle = useCallback(async ({
    collectionName,
    docId,
    questionAudioUrl,
    optionAudioUrls,
    optionKeys,
  }) => {
    const normalizedLang = lang.toLowerCase();
    const missingItems = [];
    const questionCacheKey = buildAudioCacheKey({
      collectionName,
      docId,
      lang: normalizedLang,
      type: 'question',
    });
    const resolvedQuestionUrl =
      questionAudioUrl || audioUrlCache.get(questionCacheKey);

    if (resolvedQuestionUrl) {
      cacheAudioUrl(questionCacheKey, resolvedQuestionUrl);
      ensurePreloadedAudio(questionCacheKey, resolvedQuestionUrl);
    } else if (!pendingAudioUrlCache.has(questionCacheKey)) {
      missingItems.push({ cacheKey: questionCacheKey, type: 'question' });
    }

    for (const optionKey of optionKeys || []) {
      const optionCacheKey = buildAudioCacheKey({
        collectionName,
        docId,
        lang: normalizedLang,
        type: 'option',
        optionKey,
      });
      const resolvedOptionUrl =
        optionAudioUrls?.[optionKey] || audioUrlCache.get(optionCacheKey);

      if (resolvedOptionUrl) {
        cacheAudioUrl(optionCacheKey, resolvedOptionUrl);
        ensurePreloadedAudio(optionCacheKey, resolvedOptionUrl);
        continue;
      }

      if (!pendingAudioUrlCache.has(optionCacheKey)) {
        missingItems.push({
          cacheKey: optionCacheKey,
          type: 'option',
          optionKey,
        });
      }
    }

    if (missingItems.length === 0) {
      return;
    }

    const request = axios
      .post('/api/tts', {
        collectionName,
        docId,
        lang: normalizedLang,
        type: 'question',
        includeOptions: true,
      })
      .then((res) => {
        const questionUrl = res.data.questionUrl || res.data.url || null;
        const optionUrls = res.data.optionUrls || {};

        cacheQuestionBundle({
          collectionName,
          docId,
          lang: normalizedLang,
          questionUrl,
          optionUrls,
        });

        return { questionUrl, optionUrls };
      });

    for (const item of missingItems) {
      const itemRequest = request
        .then(({ questionUrl, optionUrls }) => {
          if (item.type === 'question') {
            return questionUrl;
          }

          return optionUrls?.[item.optionKey] || null;
        })
        .finally(() => {
          pendingAudioUrlCache.delete(item.cacheKey);
        });

      pendingAudioUrlCache.set(item.cacheKey, itemRequest);
    }

    await request;
  }, [lang]);

  const preload = useCallback(async (items) => {
    if (!isSpeechSupported || typeof window === 'undefined') return;
    const queue = Array.isArray(items) ? items : [items];

    for (const item of queue) {
      if (!item?.docId || !item?.collectionName) continue;

      try {
        await preloadQuestionBundle({
          collectionName: item.collectionName,
          docId: item.docId,
          questionAudioUrl: item.questionAudioUrl,
          optionAudioUrls: item.optionAudioUrls,
          optionKeys: item.optionKeys,
        });
      } catch (error) {
        console.error('TTS preload error:', error);
      }
    }
  }, [isSpeechSupported, preloadQuestionBundle]);

  const speak = useCallback(async ({
    collectionName,
    docId,
    type,
    optionKey,
    id = 'default',
    includeOptions = false,
    questionAudioUrl,
    optionAudioUrls,
    optionKeys,
  }) => {
    try {
      if (!isSpeechSupported || !docId || typeof window === 'undefined') {
        return;
      }

      const cacheKey = buildAudioCacheKey({
        collectionName,
        docId,
        lang: lang.toLowerCase(),
        type,
        optionKey,
      });

      if (!audioUrlCache.has(cacheKey) && pendingAudioUrlCache.has(cacheKey)) {
        showPendingMessage();
        return;
      }

      if (!audioUrlCache.has(cacheKey) && includeOptions) {
        await preloadQuestionBundle({
          collectionName,
          docId,
          questionAudioUrl,
          optionAudioUrls,
          optionKeys,
        });
      }

      const { cacheKey: resolvedCacheKey, url } = await getAudioUrl({
        collectionName,
        docId,
        type,
        optionKey,
      });

      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      setSpeakingId(id);
      setStatusMessage('');

      const audio =
        preloadedAudioCache.get(resolvedCacheKey) || new Audio(url);
      audio.currentTime = 0;
      audioRef.current = audio;

      audio.onended = () => setSpeakingId(null);
      audio.onerror = () => setSpeakingId(null);

      await audio.play();
    } catch (err) {
      console.error('TTS error:', err);
      setSpeakingId(null);
    }
  }, [getAudioUrl, isSpeechSupported, lang, preloadQuestionBundle, showPendingMessage]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeakingId(null);
  }, []);

  const isSpeaking = useCallback(
    (id = 'default') => speakingId === id,
    [speakingId]
  );

  return {
    preload,
    speak,
    stop,
    isSpeaking,
    statusMessage,
    isSpeechSupported,
  };
}