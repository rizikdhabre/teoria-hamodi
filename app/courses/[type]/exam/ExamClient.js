'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/app/context/LanguageContext';
import { useQuestionSpeech } from '@/lib/useQuestionSpeech';

function buildCollectionName(source) {
  return `${source}questions`;
}

function resolveQuestion(question, lang) {
  const translation =
    question.translations?.[lang.toLowerCase()] || question.translations?.he;
  const resolvedAudio =
    question.audio?.[lang.toLowerCase()] || question.audio?.he || null;

  return {
    docId: question.docId,
    id: question.id,
    collectionName: buildCollectionName(question.source),
    source: question.source,
    hasImage: question.hasImage,
    image: question.image,
    questionAudioUrl: resolvedAudio?.question || null,
    optionAudioUrls: resolvedAudio?.options || {},
    question: translation.question,
    options: translation.options,
  };
}

function buildAudioPayload(question) {
  return {
    collectionName: question.collectionName,
    docId: question.docId,
    questionAudioUrl: question.questionAudioUrl,
    optionAudioUrls: question.optionAudioUrls || {},
    optionKeys: Object.keys(question.options || {}),
  };
}

function AudioButton({ isActive, onClick, className = '' }) {
  return (
    <button type="button" onClick={onClick} className={className}>
      {isActive ? '⏹️' : '🔊'}
    </button>
  );
}

function ExamQuestion({ question, selected, onSelect, number, lang }) {
  const { speak, stop, isSpeaking, statusMessage } = useQuestionSpeech(lang);
  const audioPayload = buildAudioPayload(question);

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

        <AudioButton
          isActive={isSpeaking('q')}
          onClick={() => {
            isSpeaking('q')
              ? stop()
              : speak({
                  ...audioPayload,
                  type: 'question',
                  id: 'q',
                  includeOptions: true,
                });
          }}
          className="shrink-0"
        />
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
        {Object.entries(question.options).map(([key, option], index) => (
          <div
            key={key}
            onClick={() => onSelect(key)}
            className={`border rounded px-4 py-2 cursor-pointer flex items-center gap-2
              ${
                selected === key
                  ? 'border-blue-500 bg-blue-900/30'
                  : 'border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
              }
            `}
          >
            <AudioButton
              isActive={isSpeaking(key)}
              onClick={(event) => {
                event.stopPropagation();

                isSpeaking(key)
                  ? stop()
                  : speak({
                      ...audioPayload,
                      type: 'option',
                      optionKey: key,
                      id: key,
                      includeOptions: true,
                    });
              }}
              className="shrink-0 text-sm"
            />
            <span className="font-bold mr-2">({index + 1})</span>
            {option.text}
          </div>
        ))}
      </div>
    </div>
  );
}

function ExamResultRow({ result, question, lang, onPreview }) {
  const { speak, stop, isSpeaking, statusMessage } = useQuestionSpeech(lang);
  const localizedQuestion = resolveQuestion(question, lang);
  const audioPayload = buildAudioPayload(localizedQuestion);
  const correctText = result.correctKey
    ? localizedQuestion.options[result.correctKey]?.text
    : '';
  const userText = result.userKey
    ? localizedQuestion.options[result.userKey]?.text
    : '';
  const isCorrect = result.userKey === result.correctKey;

  return (
    <tr className="align-top text-right">
      <td className="p-4">
        <div className="flex items-start justify-between gap-3">
          <p>
            <b>{result.number}.</b> {localizedQuestion.question}
          </p>

          <AudioButton
            isActive={isSpeaking('question')}
            onClick={() => {
              isSpeaking('question')
                ? stop()
                : speak({
                    ...audioPayload,
                    type: 'question',
                    id: 'question',
                    includeOptions: true,
                  });
            }}
            className="shrink-0"
          />
        </div>

        {statusMessage && (
          <p
            className="mt-2 text-sm text-amber-700 dark:text-amber-300"
            aria-live="polite"
          >
            {statusMessage}
          </p>
        )}

        {result.image && (
          <img
            src={`/question-images/${result.source}/${result.image}`}
            alt=""
            className="mt-2 max-h-[180px] cursor-pointer rounded"
            onClick={() =>
              onPreview(`/question-images/${result.source}/${result.image}`)
            }
          />
        )}
      </td>

      <td className="p-4 text-green-600 font-bold">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <span className="w-full">{correctText}</span>

          {result.correctKey && (
            <AudioButton
              isActive={isSpeaking('correct')}
              onClick={() => {
                isSpeaking('correct')
                  ? stop()
                  : speak({
                      ...audioPayload,
                      type: 'option',
                      optionKey: result.correctKey,
                      id: 'correct',
                      includeOptions: true,
                    });
              }}
              className="shrink-0 self-start sm:self-auto"
            />
          )}
        </div>
      </td>

      <td
        className={`p-4 font-bold ${
          isCorrect ? 'text-green-600' : 'text-red-600'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <span>{userText}</span>

          {result.userKey && userText && (
            <AudioButton
              isActive={isSpeaking('user')}
              onClick={() => {
                isSpeaking('user')
                  ? stop()
                  : speak({
                      ...audioPayload,
                      type: 'option',
                      optionKey: result.userKey,
                      id: 'user',
                      includeOptions: true,
                    });
              }}
              className="shrink-0"
            />
          )}
        </div>
      </td>
    </tr>
  );
}

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

export default function ExamClient({ type, questions }) {
  const { lang } = useLanguage();
  const { preload } = useQuestionSpeech(lang);
  const [examQuestions] = useState(() => questions);

  const PAGE_SIZE = 10;
  const config = EXAM_CONFIG[type];
  const EXAM_TIME = config?.time ?? 40 * 60;
  const totalPages = Math.ceil(examQuestions.length / PAGE_SIZE);

  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers] = useState(() => examQuestions.map(() => null));
  const [timeLeft, setTimeLeft] = useState(EXAM_TIME);
  const [examFinished, setExamFinished] = useState(false);
  const [results, setResults] = useState([]);
  const [previewImage, setPreviewImage] = useState(null);

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  const start = currentPage * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const visibleQuestions = useMemo(
    () =>
      examQuestions
        .slice(start, end)
        .map((question) => resolveQuestion(question, lang)),
    [examQuestions, start, end, lang]
  );
  const examQuestionsByDocId = useMemo(
    () => new Map(examQuestions.map((question) => [question.docId, question])),
    [examQuestions]
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  useEffect(() => {
    const preloadItems = visibleQuestions.map((question) =>
      buildAudioPayload(question)
    );

    preload(preloadItems);
  }, [preload, visibleQuestions]);

  function handleSelect(globalIndex, key) {
    setAnswers((prev) => {
      const copy = [...prev];
      copy[globalIndex] = key;
      return copy;
    });
  }

  function nextPage() {
    if (currentPage < totalPages - 1) {
      setCurrentPage((page) => page + 1);
    }
  }

  function prevPage() {
    if (currentPage > 0) {
      setCurrentPage((page) => page - 1);
    }
  }

  const submitExam = useCallback(() => {
    const nextResults = examQuestions.map((question, index) => {
      const translation =
        question.translations?.[lang.toLowerCase()] ||
        question.translations?.he;
      const correctEntry = Object.entries(translation.options).find(
        ([, option]) => option.isTrue
      );

      return {
        number: index + 1,
        docId: question.docId,
        id: question.id,
        source: question.source,
        image: question.hasImage ? question.image : null,
        correctKey: correctEntry?.[0] ?? null,
        userKey: answers[index],
      };
    });

    setResults(nextResults);
    setExamFinished(true);
  }, [answers, examQuestions, lang]);

  useEffect(() => {
    if (examFinished || timeLeft > 0) {
      return;
    }

    const timeout = setTimeout(() => {
      submitExam();
    }, 0);

    return () => clearTimeout(timeout);
  }, [examFinished, submitExam, timeLeft]);

  useEffect(() => {
    if (examFinished || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((time) => time - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [examFinished, timeLeft]);

  if (examFinished) {
    const wrongCount = results.filter(
      (result) => result.userKey !== result.correctKey
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
              {results.map((result) => {
                const question = examQuestionsByDocId.get(result.docId);

                if (!question) {
                  return null;
                }

                return (
                  <ExamResultRow
                    key={result.docId}
                    result={result}
                    question={question}
                    lang={lang}
                    onPreview={setPreviewImage}
                  />
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
              alt=""
              className="max-w-full max-h-full object-contain"
            />
          </div>
        )}
      </div>
    );
  }

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

          <button onClick={submitExam} className="p-2 bg-green-600 rounded">
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
            {Array.from({ length: totalPages }).map((_, index) => {
              const from = index * PAGE_SIZE + 1;
              const to = Math.min(
                (index + 1) * PAGE_SIZE,
                examQuestions.length
              );

              return (
                <button
                  key={index}
                  onClick={() => setCurrentPage(index)}
                  className={`w-full py-2 rounded ${
                    currentPage === index
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
          {visibleQuestions.map((question, index) => {
            const globalIndex = start + index;

            return (
              <ExamQuestion
                key={question.docId}
                question={question}
                selected={answers[globalIndex]}
                onSelect={(key) => handleSelect(globalIndex, key)}
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
