'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { fetchMoreQuestions } from '../actions';

/* ---------------- Question Card ---------------- */

function QuestionCard({
  question,
  type,
  displayNumber,
  isexam,
  selectedKey,
  onSelect,
}) {
  return (
    <div className="bg-gray-800 p-5 rounded-xl mb-6">
      {question.hasImage && question.image && (
        <img
          src={`/question-images/${type}/${question.image}`}
          alt=""
          className="mb-4 max-h-60 rounded object-contain"
        />
      )}

      <p className="font-semibold mb-4">
        {displayNumber ?? question.id}. {question.question}
      </p>

      <div className="space-y-2">
        {Object.entries(question.options).map(([key, opt], index) => {
          const isSelected = selectedKey === key;
          const isCorrect = opt.isTrue;

          return (
            <div key={key}>
              <div
                onClick={() => onSelect(key)}
                className={`
                  border rounded px-4 py-2 cursor-pointer
                  ${
                    isexam
                      ? isSelected
                        ? 'border-blue-500 bg-blue-900/30'
                        : 'border-gray-700 hover:bg-gray-700'
                      : !isSelected
                        ? 'border-gray-700 hover:bg-gray-700'
                        : isCorrect
                          ? 'border-green-500 bg-green-900/30'
                          : 'border-red-500 bg-red-900/30'
                  }
                `}
              >
                <span className="font-bold mr-2">({index + 1})</span>
                {opt.text}
              </div>

              {!isexam && isSelected && (
                <p
                  className={`mt-1 text-sm ${
                    isCorrect ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {isCorrect ? 'إجابة صحيحة' : 'إجابة خاطئة'}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Main Client ---------------- */

export default function QuestionsClient({
  type,
  initialQuestions,
  initialOffset,
  isexam = false,
}) {
  const PAGE_SIZE = isexam ? 5 : 3;
  const EXAM_DURATION = 40 * 60; // 40 minutes
  const STORAGE_KEY = `exam-${type}`;

  const [questions, setQuestions] = useState(initialQuestions);
  const [pageIndex, setPageIndex] = useState(0);
  const [offset, setOffset] = useState(initialOffset);
  const [isPending, startTransition] = useTransition();

  /* ---------- Exam State ---------- */
  const [answers, setAnswers] = useState(
    Array(initialQuestions.length).fill(null)
  );
  const [timeLeft, setTimeLeft] = useState(EXAM_DURATION);
  const [examFinished, setExamFinished] = useState(false);
  const [score, setScore] = useState(null);

  const start = pageIndex * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const visible = questions.slice(start, end);

  const totalQuestions = useMemo(() => questions.length, [questions.length]);

  const isLastPage = isexam && end >= questions.length;
  const canNext = !examFinished && (!isexam || !isLastPage);
  const canPrev = !examFinished && pageIndex > 0;

  /* ---------- Restore Exam from localStorage ---------- */
  useEffect(() => {
    if (!isexam) return;

    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const data = JSON.parse(saved);

      setQuestions(data.questions);
      setAnswers(data.answers);
      setPageIndex(data.pageIndex);
      setTimeLeft(data.timeLeft);
      setExamFinished(data.examFinished);
      setScore(data.score);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Persist Exam to localStorage ---------- */
  useEffect(() => {
    if (!isexam) return;

    const payload = {
      questions,
      answers,
      pageIndex,
      timeLeft,
      examFinished,
      score,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [
    isexam,
    questions,
    answers,
    pageIndex,
    timeLeft,
    examFinished,
    score,
  ]);

  /* ---------- Timer ---------- */
  useEffect(() => {
    if (!isexam || examFinished) return;

    const timer = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timer);
          finishExam();
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isexam, examFinished]);

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /* ---------- Answer Handler ---------- */
  function handleAnswer(globalIndex, key) {
    if (examFinished) return;

    setAnswers((prev) => {
      const copy = [...prev];
      copy[globalIndex] = key;
      return copy;
    });
  }

  /* ---------- Finish Exam ---------- */
  function finishExam() {
    if (examFinished) return;

    let correct = 0;

    answers.forEach((ans, i) => {
      if (ans && questions[i]?.options?.[ans]?.isTrue) {
        correct++;
      }
    });

    const finalScore = Math.round((correct / questions.length) * 100);
    setScore(finalScore);
    setExamFinished(true);

    setTimeout(() => {
      localStorage.removeItem(STORAGE_KEY);
    }, 0);
  }

  /* ---------- Pagination ---------- */
  function nextPage() {
    if (examFinished) return;

    if (isexam) {
      if (!isLastPage) setPageIndex((p) => p + 1);
      return;
    }

    if (end < questions.length) {
      setPageIndex((p) => p + 1);
      return;
    }

    startTransition(async () => {
      const newBatch = await fetchMoreQuestions(type, offset);
      if (!newBatch.length) return;
      setQuestions((prev) => [...prev, ...newBatch]);
      setOffset((o) => o + 40);
      setPageIndex((p) => p + 1);
    });
  }

  function prevPage() {
    if (!examFinished && pageIndex > 0) {
      setPageIndex((p) => p - 1);
    }
  }

  /* ---------- Result Screen ---------- */
  if (examFinished) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-10 text-center">
        <h2 className="text-3xl font-bold mb-4">המבחן הסתיים</h2>
        <p className="text-2xl">הציון שלך: {score} / 100</p>
      </div>
    );
  }

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {isexam && (
        <div className="flex items-center mb-6 gap-4 py-2">
          <div className="text-xl font-bold">
            ⏱️ הזמן שנשאר : {formatTime(timeLeft)}
          </div>

          <button
            onClick={finishExam}
            className="px-4 py-2 bg-green-600 rounded"
          >
            הגש
          </button>
        </div>
      )}

      {visible.map((q, i) => {
        const globalIndex = start + i;

        return (
          <QuestionCard
            key={q.id}
            question={q}
            type={type}
            isexam={isexam}
            displayNumber={isexam ? globalIndex + 1 : undefined}
            selectedKey={answers[globalIndex]}
            onSelect={(key) => handleAnswer(globalIndex, key)}
          />
        );
      })}

      <div className="flex justify-between mt-6">
        <button
          onClick={prevPage}
          disabled={!canPrev}
          className="px-4 py-2 bg-gray-700 rounded disabled:opacity-40"
        >
          חזור
        </button>

        <button
          onClick={nextPage}
          disabled={!canNext}
          className="px-4 py-2 bg-blue-600 rounded disabled:opacity-40"
        >
          הבא
        </button>
      </div>

      {!isexam && isPending && (
        <p className="mt-4 text-sm opacity-50">Loading more questions...</p>
      )}

      {isexam && (
        <p className="mt-4 text-sm opacity-70 text-center">
          Question {Math.min(end, totalQuestions)} / {totalQuestions}
        </p>
      )}
    </div>
  );
}
