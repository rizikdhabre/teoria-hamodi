'use client';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState(null);
  const [dir, setDir] = useState('ltr');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [pendingLink, setPendingLink] = useState(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryPin, setRecoveryPin] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveredPassword, setRecoveredPassword] = useState('');
  const totalImages = 3;
  const fadeDuration = 1.2;
  const intervalMs = 7000;
  const restrictedCourses = ['jetski', 'boat'];

  const handleCourses = (course) => {
    if (status !== 'authenticated') {
      router.push('/login');
      return;
    }
    if (restrictedCourses.includes(course.id)) {
      setShowPasswordModal(true);
      setPendingLink(course.link);
      return;
    }

    router.push(course.link);
  };

  const handleFetchNewPassword = async () => {
    if (!recoveryPin) {
      setRecoveryError('יש להזין  PIN');
      return;
    }

    try {
      if (recoveredPassword) return;
      setRecoveryLoading(true);
      setRecoveryError('');
      setRecoveredPassword('');

      const res = await axios.post('/api/admin/fetchPassword', {
        username: 'coursePassword',
        pin: recoveryPin,
      });

      setRecoveredPassword(res.data.password);
    } catch (err) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        'שגיאת שרת, נסה שוב';
      setRecoveryError(msg);
    } finally {
      setRecoveryLoading(false);
    }
  };

  const handlePasswordSubmit = async () => {
    try {
      const res = await axios.post('/api/coursePassword', { password });
      if (res.data.success) {
        setShowPasswordModal(false);
        setPassword('');
        setError('');
        if (pendingLink) {
          router.push(pendingLink);
          setPendingLink(null);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בשרת, נסה שוב מאוחר יותר');
      console.log(err.response?.data?.message);
    }
  };

  useEffect(() => {
    const dir = document.documentElement.dir || 'ltr';
    setDir(dir);
  }, []);

  // Auto-slide
  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((prevIdx) => {
        setPrev(prevIdx);
        return (prevIdx + 1) % totalImages;
      });
    }, intervalMs);
    return () => clearInterval(id);
  }, []);

  const goNext = () => {
    setPrev(current);
    setCurrent((current + 1) % totalImages);
  };

  const goPrev = () => {
    setPrev(current);
    setCurrent((current - 1 + totalImages) % totalImages);
  };

  // Choose background by index
  const getBackground = (index) => {
    if (index === 0) return "url('/images/bg1.jpg')";
    if (index === 1) return "url('/images/bg2.jpg')";
    return "url('/images/bg3.jpg')";
  };

  const courseGroups = [
    {
      title: '🚗 רכב ואופנוע',
      courses: [
        {
          id: 'motorcycle',
          name: ' אופנוע A',
          image: '/images/motorcycle.jpg',
          link: '/courses/motorcycle',
        },
        {
          id: 'car',
          name: 'רכב פרטי B',
          image: '/images/privateCar.jpg',
          link: '/courses/car',
        },
      ],
    },
    {
      title: '🚚 משאית',
      courses: [
        {
          id: 'truck-c1',
          name: 'משאית C1',
          image: '/images/truck.jpg',
          link: '/courses/truck',
        },
        {
          id: 'c-truck',
          name: 'משאית C',
          image: '/images/cTruckPhoto.jpg',
          link: '/courses/cTruck',
        },
      ],
    },
    {
      title: '🚌 אוטובוס ו 🚜 טרקטור',
      courses: [
        {
          id: 'bus',
          name: 'אוטובוס D',
          image: '/images/bus.jpg',
          link: '/courses/bus',
        },
        {
          id: 'tractor',
          name: 'טרקטור 1',
          image: '/images/tractor.jpg',
          link: '/courses/tractor',
        },
      ],
    },
    {
      title: '🌊 רישיונות ים',
      courses: [
        {
          id: 'jetski',
          name: 'אופנוע ים',
          image: '/images/jetski.jpg',
          link: '/courses/jetski',
        },
        {
          id: 'boat',
          name: ' סירת מנוע ',
          image: '/images/boat.jpg',
          link: '/courses/boat',
        },
      ],
    },
  ];

  const topButtons = courseGroups.flatMap((group) => group.courses);

  const advantages = [
    { icon: '📘', text: 'שיעורים פשוטים וברורים' },
    { icon: '🕐', text: 'זמינות 24/7 בכל מכשיר' },
    { icon: '💯', text: 'תרגולים עד שתעברו בהצלחה' },
    { icon: '🎯', text: 'מותאם אישית לכל סוג רישיון' },
  ];

  return (
    <main className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <section className="relative overflow-hidden py-14 text-center text-white h-[70vh] flex items-center justify-center">
        <div className="absolute inset-0">
          <motion.div
            key={`curr-${current}`}
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: getBackground(current) }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: fadeDuration }}
          />
          {prev !== null && (
            <motion.div
              key={`prev-${prev}`}
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: getBackground(prev) }}
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: fadeDuration }}
              onAnimationComplete={() => setPrev(null)}
            />
          )}
          <div className="absolute inset-0 bg-black/40  pointer-events-none" />
        </div>

        {/* Navigation arrows */}
        <button
          onClick={goPrev}
          aria-label="Previous"
          className="cursor-pointer z-20 absolute left-4 top-1/2 -translate-y-1/2 bg-white/25 hover:bg-white/40 text-white text-3xl px-3 py-1 rounded-full"
        >
          {dir === 'rtl' ? (
            <ChevronLeft size={36} strokeWidth={2.5} />
          ) : (
            <ChevronRight size={36} strokeWidth={2.5} />
          )}
        </button>
        <button
          onClick={goNext}
          aria-label="Next"
          className="cursor-pointer z-20 absolute right-4 top-1/2 -translate-y-1/2 bg-white/25 hover:bg-white/40 text-white text-3xl px-3 py-1 rounded-full"
        >
          {dir === 'rtl' ? (
            <ChevronRight size={36} strokeWidth={2.5} />
          ) : (
            <ChevronLeft size={36} strokeWidth={2.5} />
          )}
        </button>

        {/* Hero Content */}
        <motion.div
          initial={{ opacity: 0, y: 350 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.8 }}
          className="relative z-10 max-w-4xl mx-auto px-6"
        >
          <motion.h1
            className="text-4xl md:text-6xl font-extrabold mb-6 leading-tight mt-10"
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          >
            למד תיאוריה בקלות, במהירות ובכיף 🚗
          </motion.h1>

          <motion.p
            className="text-lg md:text-xl text-gray-200 dark:text-gray-100 mb-10"
            initial={{ scale: 1.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
          >
            בחר את סוג הרישיון שלך ותתחיל להתקדם — צעד אחר צעד להצלחה!
          </motion.p>

          <motion.div
            className="flex flex-wrap justify-center gap-4 mb-10"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: {},
              visible: { transition: { staggerChildren: 0.75 } },
            }}
          >
            {topButtons.map((c) => (
              <motion.div
                key={c.name}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 },
                }}
              >
                <button
                  onClick={() => {
                    const el = document.getElementById(c.id);
                    el?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }}
                  className="px-6 py-3 bg-white text-blue-700 font-semibold rounded-md shadow hover:scale-105 transition-transform"
                >
                  {c.name}
                </button>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* Advantages */}
      <section className="py-16 px-6 bg-gray-200 dark:bg-gray-800">
        <h2 className="text-3xl font-bold text-center mb-10">
          למה ללמוד אצלנו?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {advantages.map((adv) => (
            <div
              key={adv.text}
              className="bg-gray-300 dark:bg-gray-700 p-6 rounded-lg shadow-md hover:shadow-xl transition"
            >
              <div className="text-4xl mb-3">{adv.icon}</div>
              <p className="text-lg font-medium">{adv.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Courses */}
      <section className="py-16 px-6">
        <h2 className="text-3xl font-bold text-center mb-14">
          בחר את הקורס שלך
        </h2>

        {courseGroups.map((group) => (
          <div key={group.title} className="mb-10">
            {/* Group title */}
            <h3 className="text-2xl font-bold mb-8 border-b border-gray-300 dark:border-gray-600 pb-2">
              {group.title}
            </h3>

            {/* Courses grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
              {group.courses.map((course) => (
                <div
                  key={course.id}
                  id={course.id}
                  className="bg-gray-200 dark:bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:scale-105 transition-transform scroll-mt-24"
                >
                  <div className="relative w-full h-80">
                    <Image
                      src={course.image}
                      alt={course.name}
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="p-6 text-center">
                    <h4 className="text-xl font-semibold mb-3">
                      {course.name}
                    </h4>

                    <button
                      onClick={() => handleCourses(course)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md"
                    >
                      התחל עכשיו
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
      <section
        className="py-10 text-center
  bg-linear-to-t
  from-gray-200 to-gray-300
  dark:from-gray-800 dark:to-gray-900"
      >
        <h2 className="text-4xl font-bold mb-6">
          אל תחכה! אלפי תלמידים כבר עברו בהצלחה 🚦
        </h2>
      </section>
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-80">
            <h3 className="text-xl font-bold text-center mb-4">
              הזן סיסמה לקורס
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePasswordSubmit();
              }}
            >
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="סיסמה"
                className="w-full px-3 py-2 border rounded mb-3 text-black"
                autoFocus
              />

              {error && (
                <p className="text-red-500 text-sm mb-3 text-center">{error}</p>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
                >
                  אישור
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPassword('');
                    setError('');
                  }}
                  className="flex-1 bg-red-400 py-2 rounded"
                >
                  ביטול
                </button>

                <button
                  type="button"
                  onClick={() => setShowRecoveryModal(true)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded"
                >
                  שחזר
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRecoveryModal && (
        <div
          className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center"
          onClick={() => {
            // ⬅️ click outside closes modal
            setShowRecoveryModal(false);
            setRecoveryPin('');
            setRecoveryError('');
            setRecoveredPassword('');
          }}
        >
          <div
            className="relative bg-white dark:bg-gray-800 rounded-lg p-6 w-80 shadow-xl"
            onClick={(e) => e.stopPropagation()} // ⛔ prevent close when clicking inside
          >
            {/* ❌ Close button */}
            <button
              type="button"
              aria-label="Close"
              onClick={() => {
                setShowRecoveryModal(false);
                setRecoveryPin('');
                setRecoveryError('');
                setRecoveredPassword('');
              }}
              className="
          absolute top-3 end-3
          text-gray-500 hover:text-gray-800
          dark:text-gray-400 dark:hover:text-white
          transition-colors
          text-xl font-bold
        "
            >
              ✕
            </button>

            <h3 className="text-xl font-bold text-center mb-4 text-black dark:text-white">
              שחזור סיסמה (מנהל)
            </h3>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleFetchNewPassword();
              }}
            >
              {/* PIN input */}
              <input
                type="password"
                onChange={(e) => setRecoveryPin(e.target.value)}
                placeholder="PIN"
                className="
            w-full px-3 py-2 mb-3 rounded
            bg-white dark:bg-gray-700
            text-black dark:text-white
            border border-gray-300 dark:border-gray-600
            placeholder:text-gray-400 dark:placeholder:text-gray-400
            placeholder:opacity-80
            focus:outline-none focus:ring-2 focus:ring-blue-500
            transition-colors
          "
              />

              {recoveryError && (
                <p className="text-red-500 text-sm mb-3 text-center">
                  {recoveryError}
                </p>
              )}

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={recoveryLoading}
                  className="
              flex-1 bg-blue-600 hover:bg-blue-700
              disabled:opacity-50
              text-white py-2 rounded
              transition-colors
            "
                >
                  {recoveryLoading ? 'מאמת…' : 'אישור'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowRecoveryModal(false);
                    setRecoveryPin('');
                    setRecoveryError('');
                    setRecoveredPassword('');
                  }}
                  className="
              flex-1 bg-red-400 hover:bg-red-500
              text-white py-2 rounded
              transition-colors
            "
                >
                  ביטול
                </button>
              </div>
              {recoveredPassword && (
                <div
                  className="
              mt-4 p-3 rounded
              bg-green-100 dark:bg-green-900/30
              border border-green-300 dark:border-green-700
              text-green-800 dark:text-green-300
              text-center font-mono text-lg
            "
                >
                  הסיסמה: <span className="font-bold">{recoveredPassword}</span>
                </div>
              )}
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
