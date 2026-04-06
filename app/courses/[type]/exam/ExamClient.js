'use client';

import { useEffect, useState } from 'react';
import { useLanguage } from '@/app/context/LanguageContext';
import { useQuestionSpeech } from '@/lib/useQuestionSpeech';

/* ---------------- Helpers ---------------- */

function resolveQuestion(q, lang) {
  const t = q.translations?.[lang.toLowerCase()] || q.translations?.he;

  return {
    id: q.id,
    source: q.source,
    hasImage: q.hasImage,
    image: q.image,
    question: t.question,
    options: t.options,
  };
}

/* ---------------- Exam Question Card ---------------- */

function ExamQuestion({ question, selected, onSelect, number, lang }) {
  const { speak, stop, isSpeaking } = useQuestionSpeech(lang);

  return (
    <div
      data-no-translate
      className="bg-gray-200 dark:bg-gray-800 p-5 rounded-xl mb-4"
    >
      {question.hasImage && question.image && (
        <img
          src={`/question-images/${question.source}/${question.image}`}
          alt=""
          className="mb-4 max-h-60 rounded object-contain"
        />
      )}

      <div className="flex items-start justify-between gap-3 mb-4">
        <p className="font-semibold">
          {number}. {question.question}
        </p>

        <button
          type="button"
          onClick={() => isSpeaking('q') ? stop() : speak(question.question, 'q')}
          aria-label="Read question aloud"
          className="shrink-0 w-10 h-10 rounded-full border border-gray-300 dark:border-gray-600
                     flex items-center justify-center
                     bg-white dark:bg-gray-900
                     hover:bg-blue-50 dark:hover:bg-gray-700
                     transition-colors"
        >
          {isSpeaking('q') ? '⏹️' : '🔊'}
        </button>
      </div>

      <div className="space-y-2">
        {Object.entries(question.options).map(([key, opt], index) => (
          <div
            key={key}
            onClick={() => onSelect(key)}
            className={`border rounded px-4 py-2 cursor-pointer flex items-center gap-2
              ${
                selected === key
                  ? 'border-blue-500 bg-blue-900/30'
                  : 'border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
          >
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); isSpeaking(key) ? stop() : speak(opt.text, key); }}
              aria-label="Read answer aloud"
              className="shrink-0 w-7 h-7 rounded-full
                         flex items-center justify-center
                         hover:bg-gray-300 dark:hover:bg-gray-600
                         transition-colors text-sm"
            >
              {isSpeaking(key) ? '⏹️' : '🔊'}
            </button>
            <span className="font-bold mr-2">({index + 1})</span>
            {opt.text}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Config ---------------- */

const EXAM_CONFIG = {
  car: { allowedWrong: 4, time: 40 * 60 },
  cTruck: { allowedWrong: 4, time: 40 * 60 },
  truck: { allowedWrong: 4, time: 40 * 60 },
  bus: { allowedWrong: 4, time: 40 * 60 },
  tractor: { allowedWrong: 4, time: 40 * 60 },
  motorcycle: { allowedWrong: 4, time: 40 * 60 },
  jetski: { allowedWrong: 4, mandatoryAllowedWrong: 0, time: 60 * 60 },
  boat: { allowedWrong: 9, mandatoryAllowedWrong: 0, time: 60 * 60 },
};

/* ---------------- Main Exam Client ---------------- */

export default function ExamClient({ type, questions }) {
  const { lang } = useLanguage();

  /* 🔒 Freeze questions ONCE */
  const [examQuestions] = useState(() => questions);

  const PAGE_SIZE = 10;
  const config = EXAM_CONFIG[type];
  const EXAM_TIME = config?.time ?? 40 * 60;

  const totalPages = Math.ceil(examQuestions.length / PAGE_SIZE);

  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers] = useState(() =>
    examQuestions.map(() => null)
  );
  const [timeLeft, setTimeLeft] = useState(EXAM_TIME);
  const [examFinished, setExamFinished] = useState(false);
  const [results, setResults] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);

  /* ---------------- Timer ---------------- */

  useEffect(() => {
    if (examFinished) return;

    if (timeLeft <= 0) {
      submitExam();
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, examFinished]);

  function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  /* ---------------- Pagination ---------------- */

  const start = currentPage * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const visibleRaw = examQuestions.slice(start, end);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  /* ---------------- Answer Handler ---------------- */

  function handleSelect(globalIndex, key) {
    setAnswers((prev) => {
      const copy = [...prev];
      copy[globalIndex] = key;
      return copy;
    });
  }

  function nextPage() {
    if (currentPage < totalPages - 1) {
      setCurrentPage((p) => p + 1);
    }
  }

  function prevPage() {
    if (currentPage > 0) {
      setCurrentPage((p) => p - 1);
    }
  }

  /* ---------------- Submit Exam ---------------- */

  function submitExam() {
    const res = examQuestions.map((q, i) => {
      const t =
        q.translations?.[lang.toLowerCase()] ||
        q.translations?.he;

      const correctEntry = Object.entries(t.options).find(
        ([, opt]) => opt.isTrue
      );

      return {
        number: i + 1,
        id: q.id,
        source: q.source,
        image: q.hasImage ? q.image : null,
        correctKey: correctEntry?.[0] ?? null,
        userKey: answers[i],
      };
    });

    setResults(res);
    setExamFinished(true);
  }

  /* ---------------- Results ---------------- */

  if (examFinished) {
    const wrongCount = results.filter(
      (r) => r.userKey !== r.correctKey
    ).length;

    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6 mt-10">
        <h2 className="text-2xl font-bold mb-6 text-center">
          סיכום טעויות ({wrongCount})
        </h2>

        <div data-no-translate className="overflow-x-auto">
          <table className="w-full table-fixed border border-gray-300 dark:border-gray-700 text-sm">
            <thead className="bg-gray-200 dark:bg-gray-800">
              <tr>
                <th className="p-2 w-[40%]">שאלה</th>
                <th className="p-2 w-[32%]">התשובה הנכונה</th>
                <th className="p-2 w-[28%]">התשובה שלך</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => {
                const q = examQuestions.find(
                  (x) => x.id === r.id
                );
                const t =
                  q.translations?.[lang.toLowerCase()] ||
                  q.translations?.he;

                const correctText = r.correctKey
                  ? t.options[r.correctKey]?.text
                  : '';

                const userText = r.userKey
                  ? t.options[r.userKey]?.text
                  : '';

                const isCorrect =
                  r.userKey === r.correctKey;

                return (
                  <tr key={r.id} className="align-top text-right">
                    <td className="p-4">
                      <b>{r.number}.</b> {t.question}
                      {r.image && (
                        <img
                          src={`/question-images/${r.source}/${r.image}`}
                          className="mt-2 max-h-[180px] cursor-pointer rounded"
                          onClick={() =>
                            setPreviewImage(
                              `/question-images/${r.source}/${r.image}`
                            )
                          }
                        />
                      )}
                    </td>

                    <td className="p-4 text-green-600 font-bold">
                      {correctText}
                    </td>

                    <td
                      className={`p-4 font-bold ${
                        isCorrect
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}
                    >
                      {userText}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {previewImage && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setPreviewImage(null)}
          >
            <img
              src={previewImage}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}
      </div>
    );
  }

  /* ---------------- Exam View ---------------- */

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6 mt-10">
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">
            מבחן – שאלות {start + 1}–{Math.min(end, examQuestions.length)}
          </h2>

          <div className="text-red-400 font-mono text-lg">
            ⏱ {formatTime(timeLeft)}
          </div>

          <button
            onClick={submitExam}
            className="p-2 bg-green-600 rounded"
          >
            הגש
          </button>
        </div>

        <div className="mt-2 flex gap-4 text-sm font-bold">
          <span className="text-yellow-300">
            טעויות רגילות מותרות: {config.allowedWrong}
          </span>
          {(type === 'boat' || type === 'jetski') && (
            <span className="text-red-400">
              טעויות בשאלות חובה: {config.mandatoryAllowedWrong}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="bg-gray-200 dark:bg-gray-800 p-4 rounded-xl h-fit lg:sticky lg:top-6">
          <h3 className="font-bold mb-4 text-center">מפת המבחן</h3>
          <div className="space-y-2" data-no-translate>
            {Array.from({ length: totalPages }).map((_, i) => {
              const from = i * PAGE_SIZE + 1;
              const to = Math.min(
                (i + 1) * PAGE_SIZE,
                examQuestions.length
              );

              return (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={`w-full py-2 rounded ${
                    currentPage === i
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600'
                  }`}
                >
                  {from}–{to}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3">
          {visibleRaw.map((q, i) => {
            const localized = resolveQuestion(q, lang);
            const globalIndex = start + i;

            return (
              <ExamQuestion
                key={q.id}
                question={localized}
                selected={answers[globalIndex]}
                onSelect={(key) =>
                  handleSelect(globalIndex, key)
                }
                number={globalIndex + 1}
                lang={lang}
              />
            );
          })}

          <div className="flex justify-between mt-6">
            <button
              onClick={prevPage}
              disabled={currentPage === 0}
              className="px-6 py-2 rounded bg-gray-300 dark:bg-gray-700 disabled:opacity-40"
            >
              → אחורה
            </button>

            {currentPage === totalPages - 1 ? (
              <button
                onClick={submitExam}
                className="px-6 py-2 rounded bg-green-600 text-white"
              >
                הגש
              </button>
            ) : (
              <button
                onClick={nextPage}
                className="px-6 py-2 rounded bg-blue-600"
              >
                הבא ←
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
