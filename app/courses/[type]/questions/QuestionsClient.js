'use client';

import { useState, useMemo, useTransition, useEffect, useRef } from 'react';
import { fetchQuestionsByRange } from '../actions';
import { useLanguage } from '@/app/context/LanguageContext';
import { useQuestionSpeech } from '@/lib/useQuestionSpeech';

/* ---------------- Question Card ---------------- */

function QuestionCard({
  question,
  type,
  answerState,
  onSelect,
  onReveal,
  displayNumber,
}) {
  const { lang } = useLanguage();
  const { speak, stop, isSpeaking, statusMessage } = useQuestionSpeech(lang);
  const { selected, showResult, revealCorrect } = answerState;
  const RESULT_LABELS = {
    AR: {
      correct: 'إجابة صحيحة',
      wrong: 'إجابة خاطئة',
    },
    HE: {
      correct: 'תשובה נכונה',
      wrong: 'תשובה שגויה',
    },
    EN: {
      correct: 'Correct answer',
      wrong: 'Wrong answer',
    },
  };
  const labels = RESULT_LABELS[lang] || RESULT_LABELS.HE;
  return (
    <div
      data-no-translate
      className="bg-gray-200 dark:bg-gray-800 p-5 rounded-xl mb-3"
    >
      {question.hasImage && question.image && (
        <img
          src={`/question-images/${type}/${question.image}`}
          alt=""
          className="mb-4 max-h-60 rounded object-contain"
        />
      )}

      <div className="flex items-start justify-between gap-3 mb-4">
        <p
          onClick={onReveal}
          className="font-semibold cursor-pointer hover:text-blue-600 dark:hover:text-blue-400"
        >
          {displayNumber}. {question.question}
        </p>

        <button
          type="button"
          onClick={() => {
            isSpeaking('q')
              ? stop()
              : speak({
                  collectionName: `${type}questions`,
                  docId: question.docId,
                  type: 'question',
                  id: 'q',
                });
          }}
        >
          {isSpeaking('q') ? '⏹️' : '🔊'}
        </button>
      </div>

      {statusMessage && (
        <p
          className="mb-3 text-sm text-amber-700 dark:text-amber-300"
          aria-live="polite"
        >
          {statusMessage}
        </p>
      )}

      <div className="space-y-2">
        {Object.entries(question.options).map(([key, opt], index) => {
          const isCorrect = opt.isTrue;
          const isSelected = selected === key;

          const showCorrect =
            (showResult && isSelected && isCorrect) ||
            (revealCorrect && isCorrect);

          const showWrong = showResult && isSelected && !isCorrect;

          return (
            <div key={key}>
              <div
                onClick={() => onSelect(key)}
                className={`border rounded px-4 py-2 cursor-pointer flex items-center gap-2
                  ${
                    showCorrect
                      ? 'border-green-500 bg-green-900/30'
                      : showWrong
                        ? 'border-red-500 bg-red-900/30'
                        : 'border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }
                `}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();

                    isSpeaking(key)
                      ? stop()
                      : speak({
                          collectionName: `${type}questions`,
                          docId: question.docId,
                          type: 'option',
                          optionKey: key,
                          id: key,
                        });
                  }}
                >
                  {isSpeaking(key) ? '⏹️' : '🔊'}
                </button>
                <span className="font-bold mr-2">({index + 1})</span>
                {opt.text}
              </div>

              {showResult && isSelected && (
                <p
                  className={`mt-1 text-sm ${
                    isCorrect
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {isCorrect ? labels.correct : labels.wrong}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Helpers ---------------- */

function buildDbRanges(total, size) {
  const ranges = [];
  for (let i = 1; i <= total; i += size) {
    ranges.push({ from: i, to: Math.min(i + size - 1, total) });
  }
  return ranges;
}

/* ---------------- Main Client ---------------- */

export default function QuestionsClient({
  type,
  initialQuestions,
  totalCount,
  rangeSize = 10,
}) {
  const { lang } = useLanguage();
  const { preload } = useQuestionSpeech(lang);
  const [mapOpen, setMapOpen] = useState(false);
  const [questions, setQuestions] = useState(initialQuestions);
  const [isLoadingRange, setIsLoadingRange] = useState(false);
  const latestRangeRequestId = useRef(0);
  const [answers, setAnswers] = useState(
    initialQuestions.map(() => ({
      selected: null,
      showResult: false,
      revealCorrect: false,
    }))
  );

  const [activeRange, setActiveRange] = useState({
    from: 1,
    to: rangeSize,
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeRange]);

  const [isPending, startTransition] = useTransition();

  const ranges = useMemo(
    () => buildDbRanges(totalCount, rangeSize),
    [totalCount, rangeSize]
  );

  const currentIndex = ranges.findIndex(
    (r) => r.from === activeRange.from && r.to === activeRange.to
  );

  async function selectRange(range) {
    const isSameRange =
      range.from === activeRange.from && range.to === activeRange.to;

    if (isSameRange || isLoadingRange) {
      return;
    }

    const requestId = latestRangeRequestId.current + 1;
    latestRangeRequestId.current = requestId;
    setIsLoadingRange(true);

    try {
      const data = await fetchQuestionsByRange(type, range.from, range.to);

      if (latestRangeRequestId.current !== requestId) {
        return;
      }

      startTransition(() => {
        setQuestions(data);
        setAnswers(
          data.map(() => ({
            selected: null,
            showResult: false,
            revealCorrect: false,
          }))
        );
        setActiveRange(range);
      });
    } catch (error) {
      console.error('Failed to load question range:', error);
    } finally {
      if (latestRangeRequestId.current === requestId) {
        setIsLoadingRange(false);
      }
    }
  }

  function goNext() {
    if (currentIndex < ranges.length - 1) {
      selectRange(ranges[currentIndex + 1]);
    }
  }

  function goBack() {
    if (currentIndex > 0) {
      selectRange(ranges[currentIndex - 1]);
    }
  }

  function handleAnswer(index, key) {
    setAnswers((prev) => {
      const copy = [...prev];
      copy[index] = { selected: key, showResult: true, revealCorrect: false };
      return copy;
    });
  }

  function revealOnly(index) {
    setAnswers((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], revealCorrect: true };
      return copy;
    });
  }

  const localizedQuestions = useMemo(() => {
    return questions.map((q) => {
      const t = q.translations?.[lang.toLowerCase()] || q.translations?.he;
      const resolvedAudio = q.audio?.[lang.toLowerCase()] || null;

      return {
        docId: q.docId,
        id: q.id,
        hasImage: q.hasImage,
        image: q.image,
        questionAudioUrl: resolvedAudio?.question || null,
        optionAudioUrls: resolvedAudio?.options || {},
        question: t.question,
        options: t.options,
      };
    });
  }, [questions, lang]);

  useEffect(() => {
    const preloadItems = localizedQuestions.map((question) => ({
      collectionName: `${type}questions`,
      docId: question.docId,
      questionAudioUrl: question.questionAudioUrl,
      optionAudioUrls: question.optionAudioUrls || {},
      optionKeys: Object.keys(question.options),
    }));

    preload(preloadItems);
  }, [localizedQuestions, preload, type]);

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6 mt-10">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* MAP */}
        <div>
          <div className="lg:hidden mb-2">
            <button
              onClick={() => setMapOpen((v) => !v)}
              className="w-full bg-gray-200 dark:bg-gray-800 py-2 rounded-xl"
            >
              ☰ מפת שאלות
            </button>
          </div>

          <div
            className={`bg-gray-200 dark:bg-gray-800 p-4 rounded-xl ${
              mapOpen ? 'block' : 'hidden'
            } lg:block lg:sticky lg:top-6`}
          >
            <h3 className="font-bold mb-4 text-center">מפת שאלות</h3>

            <div className="grid grid-cols-3 gap-2 text-sm" data-no-translate>
              {ranges.map((r) => {
                const active =
                  r.from === activeRange.from && r.to === activeRange.to;

                return (
                  <button
                    key={`${r.from}-${r.to}`}
                    onClick={() => {
                      selectRange(r);
                      setMapOpen(false);
                    }}
                    className={`py-1 rounded ${
                      active
                        ? 'bg-blue-600'
                        : 'bg-gray-300 dark:bg-gray-700 hover:bg-gray-400'
                    }`}
                  >
                    {String(r.from).padStart(3, '0')}–
                    {String(r.to).padStart(3, '0')}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* QUESTIONS */}
        <div className="lg:col-span-3">
          {localizedQuestions.map((q, i) => (
            <QuestionCard
              key={q.docId}
              question={q}
              type={type}
              answerState={answers[i]}
              onSelect={(key) => handleAnswer(i, key)}
              onReveal={() => revealOnly(i)}
              displayNumber={activeRange.from + i}
            />
          ))}

          {/* NAV BUTTONS */}
          <div className="flex justify-between mt-6">
            <button
              onClick={goBack}
              disabled={currentIndex === 0 || isLoadingRange}
              className="px-6 py-2 rounded bg-gray-300 dark:bg-gray-700 disabled:opacity-40"
            >
              → אחורה
            </button>

            <button
              onClick={goNext}
              disabled={currentIndex === ranges.length - 1 || isLoadingRange}
              className="px-6 py-2 rounded bg-blue-600 disabled:opacity-40"
            >
              הבא ←
            </button>
          </div>

          {(isPending || isLoadingRange) && (
            <p className="text-center opacity-50 mt-2">Loading…</p>
          )}
        </div>
      </div>
    </div>
  );
}
