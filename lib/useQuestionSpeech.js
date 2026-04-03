'use client';

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';

const SPEECH_LANG_MAP = {
  HE: 'he-IL',
  AR: 'ar-SA',
  EN: 'en-US',
};

function findVoice(voices, speechLang) {
  const lo = speechLang.toLowerCase();
  const short = lo.slice(0, 2);

  const exact = voices.find((v) => v.lang?.toLowerCase() === lo);
  if (exact) return exact;

  const prefix = voices.find((v) => v.lang?.toLowerCase().startsWith(lo));
  if (prefix) return prefix;

  const broad = voices.find((v) => v.lang?.toLowerCase().startsWith(short));
  if (broad) return broad;

  return null;
}

export function buildSpeechText(question, options) {
  const optTexts = Object.values(options)
    .map((opt, i) => `${i + 1}. ${opt.text ?? opt}`)
    .join('. ');
  return `${question}. ${optTexts}`;
}

export function useQuestionSpeech(lang) {
  const [voices, setVoices] = useState([]);
  const [speaking, setSpeaking] = useState(false);
  const audioRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    function loadVoices() {
      setVoices(window.speechSynthesis.getVoices());
    }

    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);

    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
      window.speechSynthesis.cancel();
    };
  }, []);

  const speechLang = SPEECH_LANG_MAP[lang] || 'he-IL';
  const voice = useMemo(() => findVoice(voices, speechLang), [voices, speechLang]);

  /* ---- speak via OpenAI TTS API (fallback) ---- */
  const speakViaAPI = useCallback(
    async (text) => {
      try {
        setSpeaking(true);
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error('TTS request failed');

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);

        // stop any previous audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        audio.onerror = () => { setSpeaking(false); URL.revokeObjectURL(url); };
        audio.play();
      } catch {
        setSpeaking(false);
      }
    },
    [],
  );

  /* ---- speak via browser speechSynthesis ---- */
  const speakLocal = useCallback(
    (text) => {
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = speechLang;
      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      }
      utterance.rate = 0.75;
      utterance.pitch = 1;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [speechLang, voice],
  );

  /* ---- main speak: try local voice, fall back to API ---- */
  const speak = useCallback(
    (text) => {
      if (!text || typeof window === 'undefined') return;

      if (voice && window.speechSynthesis) {
        speakLocal(text);
      } else {
        speakViaAPI(text);
      }
    },
    [voice, speakLocal, speakViaAPI],
  );

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeaking(false);
  }, []);

  return { speak, stop, speaking };
}
