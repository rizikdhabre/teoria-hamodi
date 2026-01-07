'use client';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState(null);
  const [dir, setDir] = useState('ltr');
  const totalImages = 3;
  const fadeDuration = 1.2;
  const intervalMs = 7000;

  const handleCourses = (link) => {
    if (status === 'authenticated') {
      router.push(link);
    } else {
      router.push('/login');
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
          name: 'אופנוע',
          image: '/images/motorcycle.jpg',
          link: '/courses/motorcycle',
        },
        {
          id: 'car',
          name: 'רכב פרטי',
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
          name: 'אוטובוס',
          image: '/images/bus.jpg',
          link: '/courses/bus',
        },
        {
          id: 'tractor',
          name: 'טרקטור',
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
    <main className="min-h-screen bg-gray-900 text-gray-100">
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
            className="text-lg md:text-xl text-gray-100 mb-10"
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
      <section className="py-16 px-6 bg-gray-800">
        <h2 className="text-3xl font-bold text-center mb-10">
          למה ללמוד אצלנו?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {advantages.map((adv) => (
            <div
              key={adv.text}
              className="bg-gray-700 p-6 rounded-lg shadow-md hover:shadow-xl transition"
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
          <div key={group.title} className="mb-20">
            {/* Group title */}
            <h3 className="text-2xl font-bold mb-8 border-b border-gray-600 pb-2">
              {group.title}
            </h3>

            {/* Courses grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
              {group.courses.map((course) => (
                <div
                  key={course.id}
                  id={course.id}
                  className="bg-gray-800 rounded-lg overflow-hidden shadow-lg hover:scale-105 transition-transform scroll-mt-24"
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
                      onClick={() => handleCourses(course.link)}
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

      {/* Call to Action */}
      <section className="py-20 text-center bg-linear-to-t from-gray-800 to-gray-900">
        <h2 className="text-4xl font-bold mb-6">
          אל תחכה! אלפי תלמידים כבר עברו בהצלחה 🚦
        </h2>
      </section>
    </main>
  );
}
