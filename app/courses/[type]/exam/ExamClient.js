'use client';

import { useEffect, useState } from 'react';

/* ---------------- Exam Question Card ---------------- */

function ExamQuestion({ question, type, selected, onSelect, number }) {
  return (
    <div className="bg-gray-200 dark:bg-gray-800 p-5 rounded-xl mb-4">
      {question.hasImage && question.image && (
        <img
          src={`/question-images/${question.source}/${question.image}`}
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
                  : 'border-gray-300 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700'
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
const EXAM_CONFIG = {
  car: {
    questionNumber: 30,
    allowedWrong: 4,
    time: 40 * 60,
    title: 'מבחן רכב פרטי',
  },
  cTruck: {
    questionNumber: 30,
    allowedWrong: 4,
    title: 'מבחן משאית קלה',
  },
  truck: {
    questionNumber: 30,
    allowedWrong: 4,
    title: 'מבחן משאית',
  },
  bus: {
    questionNumber: 30,
    allowedWrong: 4,
    title: 'מבחן אוטובוס',
  },
  tractor: {
    questionNumber: 30,
    allowedWrong: 4,
    title: 'מבחן טרקטור',
  },
  jetski: {
    allowedWrong: 4, // רגילות
    mandatoryAllowedWrong: 0, // חובה – אפס טעויות
    title: 'מבחן אופנוע ים',
  },

  boat: {
    allowedWrong: 9, // רגילות
    mandatoryAllowedWrong: 0, // חובה – אפס טעויות
    title: 'מבחן כלי שיט',
  },
  motorcycle: {
    questionNumber: 30,
    allowedWrong: 4,
    title: 'מבחן אופנוע',
  },
};

/* ---------------- Main Exam Client ---------------- */

export default function ExamClient({ type, questions }) {
  const [previewImage, setPreviewImage] = useState(null);
  const config = EXAM_CONFIG[type];
  let EXAM_TIME = 40 * 60;
  if (type === 'boat' || type === 'jetski') {
    EXAM_TIME = 60 * 60;
  }
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

  useEffect(() => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
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
    const results = [];

    questions.forEach((q, i) => {
      const userKey = answers[i];

      const correctEntry = Object.entries(q.options).find(
        ([, opt]) => opt.isTrue
      );

      const correctKey = correctEntry?.[0] ?? null;
      const correctText = correctEntry?.[1]?.text ?? '';

      const userText = userKey ? q.options[userKey]?.text : '';

      const isCorrect = userKey === correctKey;

      results.push({
        number: i + 1,
        id: q.id,
        question: q.question,
        image: q.hasImage ? q.image : null,
        source: q.source,
        correctAnswer: correctText,
        userAnswer: userText,
        isCorrect, // ✅ KEY FIELD
      });
    });

    setResults(results);
    setExamFinished(true);
  }

  /* ---------------- Results ---------------- */

  if (examFinished) {
    const wrongCount = results.filter((r) => !r.isCorrect).length;
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6 mt-10">
        <h2 className="text-2xl font-bold mb-6 text-center">
          סיכום טעויות ({wrongCount})
        </h2>

        {results.length === 0 ? (
          <p className="text-center text-green-400 text-xl">
            🎉 אין טעויות! מבחן מושלם
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border border-gray-300 dark:border-gray-700 text-sm">
              <thead className="bg-gray-200 dark:bg-gray-800">
                <tr>
                  <th
                    className="border border-gray-300 dark:border-gray-700
 p-2 w-[40%]"
                  >
                    שאלה
                  </th>
                  <th
                    className="border border-gray-300 dark:border-gray-700
 p-2 w-[32%]"
                  >
                    התשובה הנכונה
                  </th>
                  <th
                    className="border border-gray-300 dark:border-gray-700
 p-2 w-[28%]"
                  >
                    התשובה שלך
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="align-top text-right">
                    <td
                      className="
                      border border-gray-300 dark:border-gray-700
 p-4
                      whitespace-normal break-words leading-relaxed
                      w-[45%]
                                  "
                      dir="rtl"
                    >
                      <div className="mb-3">
                        <span className="font-bold ml-1">{r.number}.</span>
                        {r.question}
                      </div>

                      {r.image && (
                        <img
                          src={`/question-images/${r.source}/${r.image}`}
                          alt=""
                          onClick={() =>
                            setPreviewImage(
                              `/question-images/${r.source}/${r.image}`
                            )
                          }
                          className="
              mx-auto
              max-h-[180px]
              w-auto
              object-contain
              cursor-pointer
              rounded
            "
                        />
                      )}
                    </td>

                    {/* CORRECT ANSWER (27.5%) */}
                    <td
                      className="
          border border-gray-300 dark:border-gray-700
 p-4
          whitespace-normal break-words leading-relaxed
          w-[27.5%]
          text-green-600 dark:text-green-400 font-bold

        "
                      dir="rtl"
                    >
                      {r.correctAnswer}
                    </td>

                    {/* USER ANSWER (27.5%) */}
                    <td
                      className={`
          border border-gray-300 dark:border-gray-700
 p-4 font-bold
          whitespace-normal break-words leading-relaxed
          w-[27.5%]
          text-center
          ${r.isCorrect ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
        `}
                    >
                      <div className="flex flex-col items-center gap-2">
                        <span>{r.userAnswer}</span>
                        <span className="text-2xl">
                          {r.isCorrect ? '✔️' : '❌'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {previewImage && (
          <div
            className="
      fixed inset-0 z-50 bg-black/90
      flex items-center justify-center
    "
            onClick={() => setPreviewImage(null)}
          >
            {/* Close Button */}
            <button
              className="
        absolute top-4 right-4
        text-white text-3xl
        font-bold
      "
              onClick={() => setPreviewImage(null)}
            >
              ✕
            </button>

            {/* Image */}
            <img
              src={previewImage}
              alt=""
              className="
        max-w-full max-h-full
        object-contain
      "
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    );
  }

  /* ---------------- Exam View ---------------- */

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6 mt-10">
      {/* HEADER */}
      <div className="mb-6">
        {/* Top row */}
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">
            מבחן – שאלות {start + 1}–{Math.min(end, questions.length)}
          </h2>

          <div className="text-red-400 font-mono text-lg">
            ⏱ {formatTime(timeLeft)}
          </div>

          <button onClick={submitExam} className="p-2 bg-green-600 rounded">
            הגש
          </button>
        </div>

        {/* Rules row */}

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
        {/* MAP – top on mobile, right on desktop */}
        <div
          className="
      bg-gray-200 dark:bg-gray-800
      p-4 rounded-xl h-fit
      order-1 lg:order-2
      lg:sticky lg:top-6
    "
        >
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
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600'
              }
            `}
                >
                  {from}–{to}
                </button>
              );
            })}
          </div>
        </div>

        {/* QUESTIONS */}
        <div className="lg:col-span-3 order-2 lg:order-1">
          {visibleQuestions.map((q, i) => {
            const globalIndex = start + i;

            return (
              <ExamQuestion
                key={q.id}
                question={q}
                type={type}
                selected={answers[globalIndex]}
                onSelect={(key) => handleSelect(globalIndex, key)}
                number={globalIndex + 1}
              />
            );
          })}

          {/* NAV BUTTONS */}
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
