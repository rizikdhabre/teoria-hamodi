import Link from 'next/link';

export default async function CoursePage({ params }) {
  const { type } = params;

  const isSeaCourse = type === 'boat' || type === 'jetski';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="bg-gray-200 dark:bg-gray-800 p-10 rounded-2xl shadow-xl w-full max-w-md text-center">
        {/* TABLE */}
        <div className="mb-6">
          <table className="w-full text-sm text-gray-900 dark:text-gray-200 border border-gray-300 dark:border-gray-700 rounded-lg overflow-hidden">
            <thead className="bg-gray-300 dark:bg-gray-700">
              <tr>
                <th className="p-2 text-right">קישור</th>
                <th className="p-2 text-right">תיאור</th>
              </tr>
            </thead>
            <tbody className="bg-gray-200 dark:bg-gray-800">
              {!isSeaCourse && (
                <tr className="border-t border-gray-300 dark:border-gray-700">
                  <td className="p-2">
                    <a
                      href="https://www.theorytest.org.il/"
                      target="_blank"
                      className="text-blue-400 hover:underline"
                    >
                      theorytest.org.il
                    </a>
                  </td>
                  <td className="p-2">תור לקביעת תיאוריה</td>
                </tr>
              )}

              {/* ONLY FOR BOAT / JETSKI */}
              {isSeaCourse && (
                <>
                  <tr className="border-t border-gray-300 dark:border-gray-700">
                    <td className="p-2">
                      <a
                        href="https://ecom.gov.il/voucherspa/input/424"
                        target="_blank"
                        className="text-blue-400 hover:underline"
                      >
                        תשלום רשיונות ים
                      </a>
                    </td>
                    <td className="p-2">תשלום אגרות ורשיונות</td>
                  </tr>

                  <tr className="border-t border-gray-300 dark:border-gray-700">
                    <td className="p-2">
                      <a
                        href="https://govisit.gov.il/he/app/auth/login"
                        target="_blank"
                        className="text-blue-400 hover:underline"
                      >
                        קביעת תור לרשיונות ים
                      </a>
                    </td>
                    <td className="p-2">זימון תור למבחן / רישיון</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>

        <p className="text-gray-900 dark:text-gray-100 mb-8 font-bold">
          תבחר איך אתה רוצה ללמוד את הקורס
        </p>

        <div className="flex gap-4">
          <Link
            href={`/courses/${type}/questions`}
            className="flex-1 py-4 rounded-xl border border-gray-300 dark:border-gray-700
                       bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200 font-medium
                       hover:border-blue-500 hover:bg-blue-500/10
                       transition text-center"
          >
            מאגר שאלות
          </Link>

          <Link
            href={`/courses/${type}/exam`}
            className="flex-1 py-4 rounded-xl border border-gray-300 dark:border-gray-700
                       bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200 font-medium
                       hover:border-blue-500 hover:bg-blue-500/10
                       transition text-center"
          >
            ליצירת מבחן
          </Link>
        </div>
      </div>
    </div>
  );
}
