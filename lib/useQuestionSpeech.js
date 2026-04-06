'use client';

import { useState, useCallback, useRef } from 'react';

/* ---- Hebrew number-to-words (0–9999) ---- */

const HE_ONES = ['', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע'];
const HE_TEENS = ['עשר', 'אחת עשרה', 'שתים עשרה', 'שלוש עשרה', 'ארבע עשרה', 'חמש עשרה', 'שש עשרה', 'שבע עשרה', 'שמונה עשרה', 'תשע עשרה'];
const HE_TENS = ['', 'עשר', 'עשרים', 'שלושים', 'ארבעים', 'חמישים', 'שישים', 'שבעים', 'שמונים', 'תשעים'];
const HE_HUNDREDS = ['', 'מאה', 'מאתיים', 'שלוש מאות', 'ארבע מאות', 'חמש מאות', 'שש מאות', 'שבע מאות', 'שמונה מאות', 'תשע מאות'];

function hebrewNumber(n) {
  if (n === 0) return 'אפס';
  const parts = [];

  if (n >= 1000) {
    const th = Math.floor(n / 1000);
    if (th === 1) parts.push('אלף');
    else if (th === 2) parts.push('אלפיים');
    else parts.push(HE_ONES[th] + ' אלפים');
    n %= 1000;
  }

  if (n >= 100) {
    parts.push(HE_HUNDREDS[Math.floor(n / 100)]);
    n %= 100;
  }

  if (n >= 10 && n <= 19) {
    parts.push(HE_TEENS[n - 10]);
    n = 0;
  } else if (n >= 20) {
    const u = HE_ONES[n % 10];
    if (u) parts.push(HE_TENS[Math.floor(n / 10)] + ' ו' + u);
    else parts.push(HE_TENS[Math.floor(n / 10)]);
    n = 0;
  }

  if (n > 0 && n < 10) parts.push(HE_ONES[n]);

  return parts.join(' ');
}

/* ---- Arabic number-to-words (0–9999) ---- */

const AR_ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة'];
const AR_TEENS = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const AR_TENS = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const AR_HUNDREDS = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];

function arabicNumber(n) {
  if (n === 0) return 'صفر';
  const parts = [];

  if (n >= 1000) {
    const th = Math.floor(n / 1000);
    if (th === 1) parts.push('ألف');
    else if (th === 2) parts.push('ألفان');
    else if (th >= 3 && th <= 9) parts.push(AR_ONES[th] + ' آلاف');
    n %= 1000;
  }

  if (n >= 100) {
    parts.push(AR_HUNDREDS[Math.floor(n / 100)]);
    n %= 100;
  }

  if (n >= 10 && n <= 19) {
    parts.push(AR_TEENS[n - 10]);
    n = 0;
  } else if (n >= 20) {
    const u = AR_ONES[n % 10];
    if (u) parts.push(u + ' و' + AR_TENS[Math.floor(n / 10)]);
    else parts.push(AR_TENS[Math.floor(n / 10)]);
    n = 0;
  }

  if (n > 0 && n < 10) parts.push(AR_ONES[n]);

  return parts.join(' و');
}

/* ---- Preprocess text so TTS reads numbers correctly ---- */

function preprocessForTTS(text, lang) {
  if (!text || !lang) return text;

  if (lang === 'AR') {
    return text.replace(/\d+(\.\d+)?/g, (match) => {
      if (match.includes('.')) {
        const [intPart, decPart] = match.split('.');
        return arabicNumber(parseInt(intPart, 10)) + ' فاصلة ' + arabicNumber(parseInt(decPart, 10));
      }
      return arabicNumber(parseInt(match, 10));
    });
  }

  if (lang === 'HE') {
    return text.replace(/\d+(\.\d+)?/g, (match) => {
      if (match.includes('.')) {
        const [intPart, decPart] = match.split('.');
        return hebrewNumber(parseInt(intPart, 10)) + ' נקודה ' + hebrewNumber(parseInt(decPart, 10));
      }
      return hebrewNumber(parseInt(match, 10));
    });
  }

  return text;
}

export function useQuestionSpeech(lang) {
  const [speakingId, setSpeakingId] = useState(null);
  const audioRef = useRef(null);

  const speak = useCallback((text, id = 'default') => {
    if (!text || typeof window === 'undefined') return;

    // stop any current playback
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setSpeakingId(id);

    const processed = preprocessForTTS(text, lang);

    fetch('/api/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: processed }),
    })
      .then((res) => {
        if (!res.ok) throw new Error('TTS failed');
        return res.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setSpeakingId(null); URL.revokeObjectURL(url); };
        audio.onerror = () => { setSpeakingId(null); URL.revokeObjectURL(url); };
        audio.play();
      })
      .catch(() => setSpeakingId(null));
  }, [lang]);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeakingId(null);
  }, []);

  const isSpeaking = useCallback((id = 'default') => speakingId === id, [speakingId]);

  return { speak, stop, isSpeaking, speakingId };
}
