'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import HeartAnimation from '@/components/ui/HeartAnimation';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';

function Input({ label, type, name, rightIcon }) {
  return (
    <div className="relative">
      <input
        type={type}
        required
        name={name}
        className="
          w-full bg-transparent
          border-b-2 border-gray-300 dark:border-white
          focus:border-[#e46033]
          outline-none
          px-1 pt-3 pb-1
          peer
          pr-8
        "
      />

      <label
        className="
          absolute left-0 top-1/2 -translate-y-1/2
          text-gray-700 dark:text-white
          peer-focus:-top-1.25
          peer-valid:-top-1.25
          peer-focus:text-[#e46033]
          peer-valid:text-[#e46033]
          transition-all
        "
      >
        {label}
      </label>

      {rightIcon && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 text-blue-600 dark:text-blue-500 hover:text-blue-700 dark:hover:text-blue-600 cursor-pointer">
          {rightIcon}
        </div>
      )}
    </div>
  );
}

function Button({ text }) {
  return (
    <button
      type="submit"
      className="relative w-full h-[45px] rounded-full border-2 border-[#e46033] font-semibold text-gray-900 dark:text-white overflow-hidden z-10 group"
    >
      <span className="absolute inset-0 -top-full bg-linear-to-b from-[#25252b] via-[#e46033] to-[#25252b] group-hover:top-0 transition-all duration-500"></span>
      <span className="relative z-10">{text}</span>
    </button>
  );
}

export default function LoginClient() {
  const [showPassword, setShowPassword] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [fetchedPassword, setFetchedPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/';

  const handleFetchPassword = async (e) => {
    e.preventDefault();
    setFetchError('');
    setFetchedPassword('');

    const formData = new FormData(e.target);
    const pin = formData.get('pin');
    const username = formData.get('username');

    if (!pin || !username) {
      setFetchError('אנא מלא את כל השדות');
      return;
    }

    try {
      const res = await axios.post('/api/admin/fetchPassword', {
        username,
        pin,
      });
      setFetchedPassword(res.data.password);
    } catch (err) {
      setFetchError(err.response?.data?.error);
    }
  };

  const handleSignin = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const identifier1 = formData.get('username');
    const identifier = identifier1.toLowerCase();
    const password = formData.get('password');
    const res = await signIn('credentials', {
      identifier,
      password,
      redirect: false,
      callbackUrl,
    });

    if (res.error) {
      setLoginError(res.error);
      return;
    }
    router.push(res.url || callbackUrl);
  };

  // 🔹 STATE DERIVED FROM URL
  const mode = searchParams.get('mode');
  const isFetchPassword = mode === 'fetchPassword';

  const colors = ['pink', 'white'];
  const [colorIndex, setColorIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setColorIndex((prev) => (prev + 1) % colors.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const currentColor = colors[colorIndex];

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-[#25252b] text-gray-900 dark:text-white">
      <motion.div
        animate={{
          boxShadow: `0 0 25px ${currentColor}`,
          borderColor: currentColor,
        }}
        transition={{ duration: 1 }}
        className="relative w-[550px] h-[450px] overflow-hidden rounded-lg border-2"
      >
        {/* Background Shapes */}
        <motion.div
          initial={{ rotate: 10, skewY: 40 }}
          animate={{
            rotate: isFetchPassword ? 0 : 10,
            skewY: isFetchPassword ? 0 : 40,
          }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          className="absolute right-0 top-[-5px] h-[600px] w-[850px] bg-linear-to-br from-[#25252c] to-[#ffffff] origin-bottom-right"
        />

        <motion.div
          initial={{ rotate: 0, skewY: 0 }}
          animate={{
            rotate: isFetchPassword ? -11 : 0,
            skewY: isFetchPassword ? -41 : 0,
          }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          className="absolute left-[250px] top-full h-[700px] w-[850px] bg-[#25252b] border-t-4 border-[#ffffff] origin-bottom-left"
        />

        {/* LOGIN FORM */}
        <AnimatePresence mode="wait">
          {!isFetchPassword && (
            <motion.div
              key="login"
              initial={{ x: 0, opacity: 1 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -150, opacity: 0 }}
              transition={{ duration: 0.7 }}
              className="absolute top-0 left-0 w-1/2 h-full flex flex-col justify-center px-8"
            >
              <h2 className="text-2xl font-bold text-center mb-3">דף כניסה</h2>
              <form onSubmit={handleSignin} className="flex flex-col gap-4">
                <Input label="שם משתמש" type="text" name="username" />
                <Input
                  label="סיסמה"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  rightIcon={
                    showPassword ? (
                      <EyeOff
                        size={20}
                        className="cursor-pointer text-gray-400 hover:text-orange-500"
                        onClick={() => setShowPassword(false)}
                      />
                    ) : (
                      <Eye
                        size={20}
                        className="cursor-pointer text-gray-400 hover:text-orange-500"
                        onClick={() => setShowPassword(true)}
                      />
                    )
                  }
                />
                {loginError && (
                  <p className="text-sm text-red-600 dark:text-red-500 text-center">
                    {loginError}
                  </p>
                )}
                <Button text="כניסה" />
                <button
                  type="button"
                  onClick={() => router.push('/login?mode=fetchPassword')}
                  className="text-orange-600 font-semibold hover:underline"
                >
                  סיסמה חודשית
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* FETCH PASSWORD FORM */}
        <AnimatePresence mode="wait">
          {isFetchPassword && (
            <motion.div
              key="fetch-password"
              initial={{ x: 150, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 150, opacity: 0.7 }}
              transition={{ duration: 0.7 }}
              className="absolute top-0 right-0 w-1/2 h-full flex flex-col justify-center px-12"
            >
              <h2 className="text-3xl font-bold text-center mb-4">
                סיסמה חודשית
              </h2>

              <form
                className="flex flex-col gap-6"
                onSubmit={handleFetchPassword}
              >
                <Input label="שם משתמש" type="text" name="username" />

                {/* PIN */}
                <Input label="קוד PIN" type="password" name="pin" />

                {fetchError && (
                  <p className="text-sm text-red-500 text-center">
                    {fetchError}
                  </p>
                )}
                <Button text="קבלת סיסמה" />
              </form>

              {fetchedPassword && (
                <div className="mt-4 text-center bg-gray-200 dark:bg-black/30 p-3 rounded">
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                    הסיסמה החדשה שלך:
                  </p>
                  <p className="text-lg font-mono text-[#e46033] select-all">
                    {fetchedPassword}
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-[#e46033] font-semibold hover:underline p-5"
              >
                כניסה
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* INFO PANEL */}
        <AnimatePresence mode="wait">
          {!isFetchPassword ? (
            <motion.div
              key="info-login"
              initial={{ x: 0, opacity: 1 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 100, opacity: 0 }}
              transition={{ duration: 0.7 }}
              className="absolute top-0 right-0 w-1/2 h-full flex flex-col justify-center text-right px-10"
            >
              <HeartAnimation />
              <h2 className="text-4xl font-bold mb-3 uppercase">ברוך הבא</h2>
              <p>אנו שמחים לראות אותכם שוב</p>
            </motion.div>
          ) : (
            <motion.div
              key="info-register"
              initial={{ x: -100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              transition={{ duration: 0.7 }}
              className="absolute top-0 left-0 w-1/2 h-full flex flex-col justify-center text-left px-10"
            >
              <HeartAnimation />
              <h2 className="text-4xl font-bold mb-3 uppercase">ברוך הבא</h2>
              <p>אנו שמחים לראות אותכם שוב</p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
