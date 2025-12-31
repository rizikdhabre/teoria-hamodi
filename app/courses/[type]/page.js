import Link from "next/link";

export default async function CoursePage({ params }) {
  const { type } = await params;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-10 rounded-2xl shadow-xl w-full max-w-md text-center">
        <p className="text-gray-100 mb-8 font-bold">
          תבחר איך אתה רוצה ללמוד את הקורס
        </p>

        <div className="flex gap-4">
          {/* Question Bank */}
          <Link
            href={`/courses/${type}/questions`}
            className="flex-1 py-4 rounded-xl border border-gray-700
                       bg-gray-900 text-gray-200 font-medium
                       hover:border-blue-500 hover:bg-blue-500/10
                       transition text-center"
          >
            מאגר שאלות
          </Link>

          {/* Generate Exam */}
          <Link
            href={`/courses/${type}/exam`}
            className="flex-1 py-4 rounded-xl border border-gray-700
                       bg-gray-900 text-gray-200 font-medium
                       hover:border-green-500 hover:bg-green-500/10
                       transition text-center"
          >
            ליצירת מבחן
          </Link>
        </div>
      </div>
    </div>
  );
}
