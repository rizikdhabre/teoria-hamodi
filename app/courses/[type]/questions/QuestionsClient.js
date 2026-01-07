'use client';

import { useState, useMemo, useTransition } from 'react';
import { fetchQuestionsByRange } from '../actions';

/* ---------------- Question Card ---------------- */

function QuestionCard({
  question,
  type,
  answerState,
  onSelect,
  onReveal,
}) {
  const { selected, showResult, revealCorrect } = answerState;

  return (
    <div className="bg-gray-800 p-5 rounded-xl mb-3">
      {/* IMAGE */}
      {question.hasImage && question.image && (
        <img
          src={`/question-images/${type}/${question.image}`}
          alt=""
          className="mb-4 max-h-60 rounded object-contain"
        />
      )}

      {/* QUESTION TEXT (CLICKABLE → REVEAL) */}
      <p
        onClick={onReveal}
        className="font-semibold mb-4 cursor-pointer hover:text-blue-400"
      >
        {question.id}. {question.question}
      </p>

      {/* OPTIONS */}
      <div className="space-y-2">
        {Object.entries(question.options).map(([key, opt], index) => {
          const isCorrect = opt.isTrue;
          const isSelected = selected === key;

          const showCorrect =
            (showResult && isSelected && isCorrect) ||
            (revealCorrect && isCorrect);

          const showWrong =
            showResult && isSelected && !isCorrect;

          return (
            <div key={key}>
              <div
                onClick={() => onSelect(key)}
                className={`
                  border rounded px-4 py-2 cursor-pointer
                  ${
                    showCorrect
                      ? 'border-green-500 bg-green-900/30'
                      : showWrong
                        ? 'border-red-500 bg-red-900/30'
                        : 'border-gray-700 hover:bg-gray-700'
                  }
                `}
              >
                <span className="font-bold mr-2">({index + 1})</span>
                {opt.text}
              </div>

              {/* FEEDBACK */}
              {showResult && isSelected && (
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
  const [questions, setQuestions] = useState(initialQuestions);
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

  const [isPending, startTransition] = useTransition();

  /* ---------- Build Map ---------- */

  const ranges = useMemo(
    () => buildDbRanges(totalCount, rangeSize),
    [totalCount, rangeSize]
  );

  /* ---------- Load Range ---------- */

  function selectRange(range) {
    setActiveRange(range);

    startTransition(async () => {
      const data = await fetchQuestionsByRange(type, range.from, range.to);
      setQuestions(data);
      setAnswers(
        data.map(() => ({
          selected: null,
          showResult: false,
          revealCorrect: false,
        }))
      );
    });
  }

  /* ---------- Answer Handlers ---------- */

  function handleAnswer(index, key) {
    setAnswers((prev) => {
      const copy = [...prev];
      copy[index] = {
        selected: key,
        showResult: true,
        revealCorrect: false,
      };
      return copy;
    });
  }

  function revealOnly(index) {
    setAnswers((prev) => {
      const copy = [...prev];
      copy[index] = {
        ...copy[index],
        revealCorrect: true,
      };
      return copy;
    });
  }

  /* ---------- UI ---------- */

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6 mt-10">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* QUESTIONS */}
        <div className="lg:col-span-3">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              type={type}
              answerState={answers[i]}
              onSelect={(key) => handleAnswer(i, key)}
              onReveal={() => revealOnly(i)}
            />
          ))}

          {isPending && (
            <p className="text-center opacity-50">Loading…</p>
          )}
        </div>

        {/* MAP */}
        <div className="bg-gray-800 p-4 rounded-xl h-fit sticky top-6">
          <h3 className="font-bold mb-4 text-center">
            מפת שאלות
          </h3>

          <div className="grid grid-cols-3 gap-2 text-sm">
            {ranges.map((r) => {
              const active =
                r.from === activeRange.from &&
                r.to === activeRange.to;

              return (
                <button
                  key={`${r.from}-${r.to}`}
                  onClick={() => selectRange(r)}
                  className={`py-1 rounded ${
                    active
                      ? 'bg-blue-600'
                      : 'bg-gray-700 hover:bg-gray-600'
                  }`}
                >
                  {`${String(r.from).padStart(3, '0')}–${String(r.to).padStart(3, '0')}`}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
