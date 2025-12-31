'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useLanguage } from '@/app/context/LanguageContext';

/* ---------------- Helpers ---------------- */

function collectTextNodes() {
  const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'SVG']);
  const nodes = [];

  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const p = node.parentElement;
        if (!p) return NodeFilter.FILTER_REJECT;
        if (SKIP.has(p.tagName)) return NodeFilter.FILTER_REJECT;
        if (p.closest('[data-no-translate]')) return NodeFilter.FILTER_REJECT;

        const t = node.nodeValue;
        if (!t || !t.trim()) return NodeFilter.FILTER_REJECT;

        if (node.__translated === true) {
          return NodeFilter.FILTER_REJECT;
        }

        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  while (walker.nextNode()) {
    nodes.push(walker.currentNode);
  }

  return nodes;
}

function resetTranslatedNodes() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);

  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.__translated) {
      node.__translated = false;
      if (node.__originalText) {
        node.nodeValue = node.__originalText;
      }
    }
  }
}

function codeToTargetLang(code) {
  return code === 'HE' ? 'Hebrew' : code === 'AR' ? 'Arabic' : 'English';
}

/* ---------------- Translation Manager ---------------- */

export default function TranslationManager() {
  const { lang } = useLanguage();
  const pathname = usePathname();

  const obsRef = useRef(null);
  const timerRef = useRef(null);
  const runningRef = useRef(false);

  /* 🔁 Reset text when language changes */
  useEffect(() => {
    resetTranslatedNodes();
  }, [lang]);

  /* 🌍 Translate DOM when needed */
  useEffect(() => {
    // Hebrew = original language → show immediately
    if (lang === 'HE') {
      document.documentElement.style.visibility = 'visible';
      return;
    }

    const run = async () => {
      if (runningRef.current) return;
      runningRef.current = true;

      try {
        const nodes = collectTextNodes();

        if (!nodes.length) {
          // Nothing to translate → still unlock page
          document.documentElement.style.visibility = 'visible';
          return;
        }

        const texts = nodes.map((n) => n.nodeValue.trim());
        const pageId = pathname;
        const targetLang = codeToTargetLang(lang);

        const res = await fetch('/api/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageId, targetLang, texts }),
        });

        const data = await res.json();
        if (!data?.translatedTexts) return;

        const translated = data.translatedTexts;
        const len = Math.min(nodes.length, translated.length);

        for (let i = 0; i < len; i++) {
          const tr = translated[i];
          if (!tr) continue;

          const before = nodes[i].nodeValue;
          const lead = before.startsWith(' ') ? ' ' : '';
          const trail = before.endsWith(' ') ? ' ' : '';

          nodes[i].__originalText = before;
          nodes[i].nodeValue = lead + tr + trail;
          nodes[i].__translated = true;
        }
      } catch (e) {
        console.error('TranslationManager error:', e);
      } finally {
        runningRef.current = false;

        // 🔓 IMPORTANT: unlock page AFTER translation
        document.documentElement.style.visibility = 'visible';
      }
    };

    const schedule = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(run, 120);
    };

    schedule();

    obsRef.current = new MutationObserver(schedule);
    obsRef.current.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });

    return () => {
      obsRef.current?.disconnect();
      clearTimeout(timerRef.current);
    };
  }, [lang, pathname]);

  return null;
}
