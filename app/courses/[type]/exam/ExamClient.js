'use client';

import { useEffect, useState } from 'react';

/* ---------------- Exam Question Card ---------------- */

function ExamQuestion({ question, type, selected, onSelect,number }) {
  return (
    <div className="bg-gray-800 p-5 rounded-xl mb-4">
      {question.hasImage && question.image && (
        <img
          src={`/question-images/${type}/${question.image}`}
          alt=""
          className="mb-4 max-h-60 rounded object-contain"
        />
      )}

      <p className="font-semibold mb-4">
        {number}. {question.question}
      </p>

      <div className="space-y-2">
        {Object.entries(question.options).map(([key, opt], index) => (
          <div
            key={key}
            onClick={() => onSelect(key)}
            className={`border rounded px-4 py-2 cursor-pointer
              ${
                selected === key
                  ? 'border-blue-500 bg-blue-900/30'
                  : 'border-gray-700 hover:bg-gray-700'
              }
            `}
          >
            <span className="font-bold mr-2">({index + 1})</span>
            {opt.text}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Main Exam Client ---------------- */

export default function ExamClient({ type, questions }) {
  const EXAM_TIME = 40 * 60;
  const PAGE_SIZE = 10;

  const totalPages = Math.ceil(questions.length / PAGE_SIZE);

  const [currentPage, setCurrentPage] = useState(0);
  const [answers, setAnswers] = useState(questions.map(() => null));
  const [timeLeft, setTimeLeft] = useState(EXAM_TIME);
  const [examFinished, setExamFinished] = useState(false);
  const [results, setResults] = useState([]);

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
  const visibleQuestions = questions.slice(start, end);

  /* ---------------- Answer Handler ---------------- */

  function handleSelect(globalIndex, key) {
    setAnswers((prev) => {
      const copy = [...prev];
      copy[globalIndex] = key;
      return copy;
    });
  }

  /* ---------------- Submit Exam ---------------- */

  function submitExam() {
    const wrong = [];

    questions.forEach((q, i) => {
      const userKey = answers[i];

      const correctEntry = Object.entries(q.options).find(
        ([, opt]) => opt.isTrue
      );

      const correctKey = correctEntry?.[0] ?? null;
      const correctText = correctEntry?.[1]?.text ?? '';

      const userText = userKey
        ? q.options[userKey]?.text
        : 'לא נענה';

      if (userKey !== correctKey) {
        wrong.push({
          id: q.id,
          question: q.question,
          image: q.hasImage ? q.image : null,
          correctAnswer: correctText,
          userAnswer: userText,
        });
      }
    });

    setResults(wrong);
    setExamFinished(true);
  }

  /* ---------------- Results ---------------- */

  if (examFinished) {
    return (
      <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
        <h2 className="text-2xl font-bold mb-6 text-center">
          סיכום טעויות ({results.length})
        </h2>

        {results.length === 0 ? (
          <p className="text-center text-green-400 text-xl">
            🎉 אין טעויות! מבחן מושלם
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-700 text-sm">
              <thead className="bg-gray-800">
                <tr>
                  <th className="border border-gray-700 p-2">שאלה</th>
                  <th className="border border-gray-700 p-2">תמונה</th>
                  <th className="border border-gray-700 p-2">התשובה הנכונה</th>
                  <th className="border border-gray-700 p-2">התשובה שלך</th>
                </tr>
              </thead>

              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="text-center">
                    <td className="border border-gray-700 p-2">
                      {r.id}. {r.question}
                    </td>

                    <td className="border border-gray-700 p-6">
                      {r.image ? (
                        <img
                          src={`/question-images/${type}/${r.image}`}
                          alt=""
                          className="max-h-30 "
                        />
                      ) : (
                        '—'
                      )}
                    </td>

                    <td className="border border-gray-700 p-2 text-green-400">
                      {r.correctAnswer}
                    </td>

                    <td className="border border-gray-700 p-2 text-red-400">
                      {r.userAnswer}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  /* ---------------- Exam View ---------------- */

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">
          מבחן – שאלות {start + 1}–{Math.min(end, questions.length)}
        </h2>

        <div className="text-red-400 font-mono text-lg">
          ⏱ {formatTime(timeLeft)}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* QUESTIONS */}
        <div className="lg:col-span-3">
          {visibleQuestions.map((q, i) => {
            const globalIndex = start + i;

            return (
              <ExamQuestion
                start={start}
                key={q.id}
                question={q}
                type={type}
                selected={answers[globalIndex]}
                onSelect={(key) => handleSelect(globalIndex, key)}
                number={globalIndex + 1}
              />
            );
          })}
        </div>

        {/* MAP */}
        <div className="bg-gray-800 p-4 rounded-xl h-fit sticky top-6">
          <h3 className="font-bold mb-4 text-center">מפת המבחן</h3>

          <div className="space-y-2">
            {Array.from({ length: totalPages }).map((_, i) => {
              const from = i * PAGE_SIZE + 1;
              const to = Math.min((i + 1) * PAGE_SIZE, questions.length);

              return (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={`w-full py-2 rounded
                    ${
                      currentPage === i
                        ? 'bg-blue-600'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }
                  `}
                >
                  {from}–{to}
                </button>
              );
            })}
          </div>

          <button
            onClick={submitExam}
            className="mt-4 w-full py-2 bg-green-600 rounded"
          >
            הגש מבחן
          </button>
        </div>
      </div>
    </div>
  );
}
