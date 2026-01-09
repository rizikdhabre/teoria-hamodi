'use client';
import { useLanguage } from '@/app/context/LanguageContext';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from '@/app/context/ThemeContext';

export default function Header() {
  const { theme, toggleTheme } = useTheme();
  const { data: session, status } = useSession();
  const { lang, changeLang } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openLogo, setOpenLogo] = useState(false);

  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [showHeader, setShowHeader] = useState(true);

  const menuRef = useRef(null);
  const listRef = useRef([]);

  const logoMenuRef = useRef(null);

  // close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (logoMenuRef.current && !logoMenuRef.current.contains(e.target)) {
        setOpenLogo(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const options = [
    { code: 'HE', label: 'HE — עברית' },
    { code: 'AR', label: 'AR — العربية' },
    { code: 'EN', label: 'EN — English' },
  ];

  /* ---------------- Scroll hide/show header ---------------- */
  useEffect(() => {
    let lastY = window.scrollY;

    function handleScroll() {
      const currentY = window.scrollY;
      setShowHeader(currentY <= lastY);
      lastY = currentY;
    }

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  /* ---------------- Outside click ---------------- */
  useEffect(() => {
    function onClickOutside(e) {
      if (open && menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  /* ---------------- Keyboard navigation ---------------- */
  useEffect(() => {
    function onKey(e) {
      if (!open) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedIndex((i) => (i + 1) % options.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedIndex((i) => (i - 1 + options.length) % options.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setOpen(false);
        changeLang(options[focusedIndex].code);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, focusedIndex]);

  /* ---------------- Scroll focused item into view ---------------- */
  useEffect(() => {
    if (open && listRef.current[focusedIndex]) {
      listRef.current[focusedIndex].scrollIntoView({ block: 'nearest' });
    }
  }, [focusedIndex, open]);

  /* ---------------- Toggle menu positioning ---------------- */
  function toggleMenu() {
    setOpen((prev) => {
      const willOpen = !prev;
      if (willOpen && menuRef.current) {
        setTimeout(() => {
          const rect = menuRef.current.getBoundingClientRect();
          const dropdown = menuRef.current.querySelector('ul');
          if (!dropdown) return;

          const dropdownWidth = 112;
          const spaceRight = window.innerWidth - rect.right;
          const spaceLeft = rect.left;

          if (spaceRight < dropdownWidth / 2) {
            dropdown.style.left = 'auto';
            dropdown.style.right = '0';
            dropdown.style.transform = 'none';
          } else if (spaceLeft < dropdownWidth / 2) {
            dropdown.style.left = '0';
            dropdown.style.right = 'auto';
            dropdown.style.transform = 'none';
          } else {
            dropdown.style.left = '50%';
            dropdown.style.right = 'auto';
            dropdown.style.transform = 'translateX(-50%)';
          }
        }, 0);
      }
      return willOpen;
    });
  }


  return (
    <>
      {/* HEADER */}
      <header
        className={`fixed top-0 left-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-md text-gray-900 dark:text-gray-100 shadow-lg z-9999
          transform transition-transform duration-300 ${
            showHeader ? 'translate-y-0' : '-translate-y-full'
          }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between px-1 py-4">
          {/* Logo + Greeting */}
          {status === 'authenticated' && (
            <div className="relative" ref={logoMenuRef}>
              {/* Avatar + Welcome */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setOpenLogo((prev) => !prev)}
                  className="focus:outline-none"
                >
                  <img
                    src={
                      session.user.image ||
                      '/images/avatar.png' ||
                      '/avatar.png'
                    }
                    alt="Profile"
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-white/30 hover:ring-white/60 transition"
                  />
                </button>
                <span className="font-semibold text-gray-900 dark:text-white">
                  ברוך הבא -חמודי תיאוריה
                </span>
              </div>

              {/* Dropdown */}
              {openLogo && (
                <div
                  className="
      absolute right-0 mt-3 w-48
      rounded-2xl
      bg-white/90 backdrop-blur-xl
      shadow-[0_10px_40px_rgba(0,0,0,0.2)]
      border border-black/5
      z-50 overflow-hidden
    "
                >
                  {/* Logout */}
                  <button
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="
        w-full flex items-center justify-center gap-2
        px-5 py-3 text-sm font-medium
        text-red-500
        hover:bg-red-50
        transition
      "
                  >
                    <span>יציאה</span>
                    <span>🚪</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <nav className="hidden md:flex gap-8 font-medium text-gray-900 dark:text-white">
            <Link href="/about" className="hover:text-blue-400">
              אודות
            </Link>
            <Link href="/" className="hover:text-blue-400">
              בית
            </Link>
            <Link href="contactUs" className="hover:text-blue-400">
              צור קשר
            </Link>
            <Link href="/login" className="hover:text-blue-400">
              הרשמה/כניסה
            </Link>
          </nav>
          <button
            onClick={toggleTheme}
            className="ml-3 w-10 h-10 rounded-full
             bg-gray-200 dark:bg-gray-700
             flex items-center justify-center
             hover:scale-105 transition"
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>


          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex flex-col gap-1"
            aria-label="Open menu"
          >
            <span className="w-6 h-0.5 bg-gray-900 dark:bg-white"></span>

            <span className="w-6 h-0.5 bg-gray-900 dark:bg-white"></span>

            <span className="w-6 h-0.5 bg-gray-900 dark:bg-white"></span>
          </button>

          {/* Language Dropdown */}
          <div className="relative" ref={menuRef} data-no-translate>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={open}
              onClick={toggleMenu}
              className="w-10 h-10 rounded-full border border-gray-300 dark:border-gray-200
                         text-xs shadow-lg font-semibold flex items-center
                         justify-center hover:bg-gray-200 dark:hover:bg-gray-700
                         text-gray-900 dark:text-white"
            >
              {lang}
            </button>

            {open && (
              <ul
                data-no-translate
                role="listbox"
                className="absolute right-0 sm:left-1/2 sm:-translate-x-1/2 mt-2
                           bg-white dark:bg-gray-800/90 backdrop-blur-md
                           border border-gray-300 dark:border-gray-700
                           rounded-xl shadow-lg w-28 max-h-32 overflow-y-auto
                           text-sm text-gray-900 dark:text-gray-200"
              >
                {options.map((opt, i) => (
                  <li key={opt.code}>
                    <button
                      ref={(el) => (listRef.current[i] = el)}
                      role="option"
                      aria-selected={lang === opt.code}
                      onClick={() => {
                        if (opt.code !== lang) changeLang(opt.code);
                        setOpen(false);
                      }}
                      className={`w-full text-right px-3 py-2 hover:bg-gray-200 dark:hover:bg-gray-700
                       ${focusedIndex === i ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
                    >
                      {opt.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex flex-col items-center gap-4 py-3 font-medium ">
            <Link href="/about" onClick={() => setMobileMenuOpen(false)}>
              אודות
            </Link>
            <Link href="/" onClick={() => setMobileMenuOpen(false)}>
              בית
            </Link>
            <Link href="contactUs" onClick={() => setMobileMenuOpen(false)}>
              צור קשר
            </Link>
            <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
              הרשמה/כניסה
            </Link>
          </nav>
        )}
      </header>
    </>
  );
}
