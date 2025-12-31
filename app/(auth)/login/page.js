'use client';

import { signIn } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import HeartAnimation from '@/components/ui/HeartAnimation';
import { FaFacebookF, FaGoogle, FaPhoneAlt } from 'react-icons/fa';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';

function Input({ label, type, name }) {
  return (
    <div className="relative">
      <input
        type={type}
        required
        name={name}
        className="w-full bg-transparent border-b-2 border-white focus:border-[#e46033] outline-none px-1 pt-3 pb-1 peer"
      />
      <label className="absolute left-0 top-1/2 -translate-y-1/2 text-white peer-focus:top-[-5px] peer-valid:top-[-5px] peer-focus:text-[#e46033] peer-valid:text-[#e46033] transition-all">
        {label}
      </label>
    </div>
  );
}

function Button({ text }) {
  return (
    <button
      type="submit"
      className="relative w-full h-[45px] rounded-full border-2 border-[#e46033] font-semibold text-white overflow-hidden z-10 group"
    >
      <span className="absolute inset-0 -top-full bg-linear-to-b from-[#25252b] via-[#e46033] to-[#25252b] group-hover:top-0 transition-all duration-500"></span>
      <span className="relative z-10">{text}</span>
    </button>
  );
}

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [registerError, setRegisterError] = useState('');
  const [loginError, setLoginError] = useState('');
    const router = useRouter();
  const searchParams = useSearchParams();

  function validateRegisterBody(body) {
    if (!body) return false;

    const { username, email, password } = body;

    // Check for null / undefined / empty strings
    if (!username?.trim() || !email?.trim() || !password?.trim()) {
      return false;
    }

    // Email regex (safe + commonly used)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return false;
    }

    return true;
  }
  const handleSubmitRegister = async (e) => {
    e.preventDefault();
    setRegisterError('');

    const formData = new FormData(e.target);

    const body = {
      username: formData.get('username'),
      email: formData.get('email'),
      password: formData.get('password'),
    };

    if (!validateRegisterBody(body)) {
      setRegisterError('אנא מלא את כל השדות כראוי.');
      return;
    }

    try {
      await axios.post('/api/signup', body);

      // SUCCESS
      router.push('/login');
    } catch (error) {
      const status = error.response?.status;
      if (status === 409) {
        // email or username already exists
        setRegisterError('האימייל או שם המשתמש כבר בשימוש');
      } else if (status === 400) {
        setRegisterError('קלט לא תקין');
      } else {
        setRegisterError('אירעה שגיאה במהלך ההרשמה. אנא נסה שוב.');
      }
    }
  };

  const handleSignin = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const identifier = formData.get('username');
    const password = formData.get('password');
    // i will use nextAuth login 
   const res= await signIn('credentials', {
      identifier,
      password,
      redirect: false, 
    });

    if(res.error){
      setLoginError(res.error)
      return
    }
    router.push('/');
  };

  // 🔹 STATE DERIVED FROM URL
  const mode = searchParams.get('mode');
  const isRegister = mode === 'register';

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
    <div className="flex items-center justify-center min-h-screen bg-[#25252b] text-white">
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
            rotate: isRegister ? 0 : 10,
            skewY: isRegister ? 0 : 40,
          }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          className="absolute right-0 top-[-5px] h-[600px] w-[850px] bg-linear-to-br from-[#25252c] to-[#ffffff] origin-bottom-right"
        />

        <motion.div
          initial={{ rotate: 0, skewY: 0 }}
          animate={{
            rotate: isRegister ? -11 : 0,
            skewY: isRegister ? -41 : 0,
          }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          className="absolute left-[250px] top-full h-[700px] w-[850px] bg-[#25252b] border-t-4 border-[#ffffff] origin-bottom-left"
        />

        {/* LOGIN FORM */}
        <AnimatePresence mode="wait">
          {!isRegister && (
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
                <Input label="סיסמה" type="password" name="password" />
                {loginError && (
                  <p className="text-sm text-red-500 text-center">
                    {loginError}
                  </p>
                )}
                <button
                  type="button"
                  className="text-sm text-right text-gray-100 hover:text-orange-600 hover:underline transition cursor-pointer"
                >
                  שכחת סיסמה?
                </button>
                <Button text="כניסה" />

                <div className="flex justify-center gap-4 mt-2">
                  <button
                    onClick={() => signIn('facebook', { callbackUrl: '/' })}
                    className="px-4 py-2 rounded-full border-2 border-blue-500 text-blue-500 hover:bg-blue-600 hover:text-white"
                  >
                    <FaFacebookF />
                  </button>
                  <button className="px-4 py-2 rounded-full border-2 border-red-500 text-red-500 hover:bg-red-600 hover:text-white">
                    <FaGoogle />
                  </button>
                </div>

                <p className="text-sm text-center">אין לך חשבון?</p>

                <button
                  type="button"
                  onClick={() => router.push('/login?mode=register')}
                  className="text-orange-600 font-semibold hover:underline"
                >
                  הרשמה
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        {/* REGISTER FORM */}
        <AnimatePresence mode="wait">
          {isRegister && (
            <motion.div
              key="register"
              initial={{ x: 150, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 150, opacity: 0.7 }}
              transition={{ duration: 0.7 }}
              className="absolute top-0 right-0 w-1/2 h-full flex flex-col justify-center px-12"
            >
              <h2 className="text-3xl font-bold text-center mb-4">הרשמה</h2>

              <form
                className="flex flex-col gap-6"
                onSubmit={handleSubmitRegister}
              >
                <Input label="שם משתמש" type="text" name="username" />
                <Input label="אימייל" type="email" name="email" />
                <div className="relative">
                  <Input
                    label="סיסמה"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 "
                  >
                    {showPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
                {registerError && (
                  <p className="text-sm text-red-500 text-center">
                    {registerError}
                  </p>
                )}
                <Button text="הרשמה" />
              </form>

              <p className="text-sm text-center m-2">יש לכך חשבון?</p>

              <button
                type="button"
                onClick={() => router.push('/login')}
                className="text-[#e46033] font-semibold hover:underline"
              >
                כניסה
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* INFO PANEL */}
        <AnimatePresence mode="wait">
          {!isRegister ? (
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
