export default function Footer() {
  return (
   <footer className="bg-gray-200 dark:bg-gray-900 text-gray-900 dark:text-gray-100 border-t border-gray-300 dark:border-gray-800">

     <div className="container mx-auto px-4 py-4 text-center text-xs md:text-sm text-gray-600 dark:text-gray-400">

        © {new Date().getFullYear()} תיאוריה חמודי · כל הזכויות שמורות
      </div>
    </footer>
  );
}
