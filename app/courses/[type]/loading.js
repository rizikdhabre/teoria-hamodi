export default function Loading() {
  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-6 mt-10">
      <div className="max-w-3xl mx-auto">
        <div className="bg-gray-200 dark:bg-gray-800 rounded-2xl p-8 text-center shadow-lg">
          <div className="w-10 h-10 mx-auto mb-4 rounded-full border-4 border-gray-300 dark:border-gray-700 border-t-blue-600 animate-spin" />
          <p className="font-semibold">טוען שאלות...</p>
        </div>
      </div>
    </div>
  );
}