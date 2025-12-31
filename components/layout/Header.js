'use client';
import { useLanguage } from '@/app/context/LanguageContext';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { FiSearch } from 'react-icons/fi';

export default function Header() {
  const { data: session, status } = useSession();
  const { lang, changeLang } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openLogo, setOpenLogo] = useState(false);

  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
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

  /* ---------------- Close search on Escape ---------------- */
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') setSearchOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <>
      {/* HEADER */}
      <header
        className={`fixed top-0 left-0 w-full bg-gray-900/80 backdrop-blur-md text-gray-100 shadow-lg z-9999
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
                    src={session.user.image ||  '/images/avatar.png' ||'/avatar.png'}
                    alt="Profile"
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-white/30 hover:ring-white/60 transition"
                  />
                </button>
                <span className="font-semibold text-white" data-no-translate >
                  {`שלום, ${session.user.firstName || session.user.username||session.user.name}`}
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
                  {/* Profile */}
                  <Link
                    href="/profile"
                    onClick={() => setOpenLogo(false)}
                    className="
        flex items-center justify-center gap-2
        px-5 py-3 text-sm font-medium
        text-gray-800
        hover:bg-gray-100/80
        transition
      "
                  >
                    <span>פרופיל</span>
                    <span className="text-purple-600">👤</span>
                  </Link>

                  {/* Divider */}
                  <div className="mx-6 h-px bg-gray-200/70" />

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
          <nav className="hidden md:flex gap-8 font-medium text-white">
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
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex flex-col gap-1"
            aria-label="Open menu"
          >
            <span className="w-6 h-0.5 bg-white"></span>
            <span className="w-6 h-0.5 bg-white"></span>
            <span className="w-6 h-0.5 bg-white"></span>
          </button>

          {/* Search */}
          <div className="flex items-center gap-2">
            {/* Mobile: Search Icon only */}
            <button
              onClick={() => setSearchOpen(true)}
              className="
                    md:hidden
                    p-2 rounded-full
                    text-white
                    hover:bg-gray-100
                    transition
                  "
              aria-label="Open search"
            >
              <FiSearch className="text-lg" />
            </button>

            {/* Desktop: Search Input */}
            <input
              type="text"
              placeholder="Search..."
              readOnly
              onClick={() => setSearchOpen(true)}
              onFocus={() => setSearchOpen(true)}
              className="
                    hidden md:block
                    w-36 md:w-60
                    px-3 py-2 rounded-full text-sm
                    text-black cursor-pointer
                    border border-gray-300
                    focus:outline-none focus:ring-2 focus:ring-blue-500
                    placeholder-gray-500
                  "
            />
          </div>

          {/* Language Dropdown */}
          <div className="relative" ref={menuRef} data-no-translate>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={open}
              onClick={toggleMenu}
              className="w-10 h-10 rounded-full border border-gray-200
                         text-xs shadow-lg font-semibold flex items-center
                         justify-center hover:bg-gray-200 text-white"
            >
              {lang}
            </button>

            {open && (
              <ul
                data-no-translate
                role="listbox"
                className="absolute right-0 sm:left-1/2 sm:-translate-x-1/2 mt-2
                           bg-gray-800/90 backdrop-blur-md border border-gray-700
                           rounded-xl shadow-lg w-28 max-h-32 overflow-y-auto
                           text-sm text-gray-200"
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
                      className={`w-full text-right px-3 py-2 hover:bg-gray-700
                        ${focusedIndex === i ? 'bg-gray-700' : ''}`}
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
          <nav className="md:hidden bg-gray-800 flex flex-col items-center gap-4 py-3 font-medium ">
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

      {/* SEARCH OVERLAY */}
      {searchOpen && (
        <div
          data-no-translate
          className="fixed inset-0 bg-black/40 backdrop-blur-sm
                     flex items-center justify-center z-50"
        >
          <div className="w-11/12 md:w-1/2 relative text-white">
            <input
              type="text"
              autoFocus
              placeholder="Type to search..."
              className="w-full px-5 py-3 text-lg rounded-full text-white
                         focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-white placeholder:text-center"
            />
            <button
              onClick={() => setSearchOpen(false)}
              className="absolute right-3 top-1/2 -translate-y-1/2
                         text-gray-500 hover:text-gray-700 text-xl "
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
