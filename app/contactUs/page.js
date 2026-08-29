'use client';

import { Phone, MapPin, Clock } from 'lucide-react';
import { FaWhatsapp, FaInstagram } from 'react-icons/fa';
import { useTranslationStrings } from '@/app/context/TranslationContext';

const WHATSAPP_URL = 'https://wa.me/972549696666';
const INSTAGRAM_URL = 'https://www.instagram.com/teouria_hamodi';
const PHONE_URL = 'tel:+972549696666';
const CONTACT_HEBREW_SOURCES = [
  'יצירת קשר',
  'נשמח לענות על כל שאלה וללוות אתכם בדרך להצלחה',
  'ישראל',
  'ראשון–שישי | 08:00–20:00',
];

export default function ContactPage() {
  const t = useTranslationStrings(CONTACT_HEBREW_SOURCES);

  return (
    <div className="min-h-screen flex flex-col bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <main className="grow flex items-center justify-center">
        <section className="w-full max-w-md px-4 text-center">
          <h1 className="text-3xl font-bold mb-4">{t('יצירת קשר')}</h1>

          <p className="text-gray-600 dark:text-gray-400 mb-6 text-base">
            {t('נשמח לענות על כל שאלה וללוות אתכם בדרך להצלחה')}
          </p>

          <div className="rounded-xl bg-gray-200 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 shadow p-5 space-y-4">
            {/* Phone */}
            <a
              href={PHONE_URL}
              className="flex items-center justify-center gap-3 text-2xl font-bold text-primary hover:opacity-80 transition"
              dir="ltr"
            >
              <Phone className="w-6 h-6" />
              054-969-6666
            </a>

            {/* Info */}
            <div className="flex flex-col gap-2 text-gray-600 dark:text-gray-400 text-sm">
              <div className="flex items-center justify-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                {t('ישראל')}
              </div>

              <div className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                {t('ראשון–שישי | 08:00–20:00')}
              </div>
            </div>

            {/* Social Buttons */}
            <div className="pt-4 flex justify-center gap-4">
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-600 hover:opacity-90 text-white rounded-full p-3 shadow-lg flex items-center justify-center"
              >
                <FaInstagram size={20} />
              </a>

              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="bg-green-500 hover:bg-green-600 text-white rounded-full p-3 shadow-lg flex items-center justify-center"
              >
                <FaWhatsapp size={20} />
              </a>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
