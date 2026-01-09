'use client';

import Image from 'next/image';
import {
  Phone,
  MapPin,
  Clock,
  Award,
  Users,
  Car,
  Bike,
  Truck,
  Ship,
  Tractor,
  Bus,
} from 'lucide-react';

export default function AboutPage() {
  const licenseTypes = [
    { icon: Car, label: 'רכב פרטי (B)' },
    { icon: Bus, label: 'רכב ציבורי (D)' },
    { icon: Bike, label: 'אופנוע (A)' },
    { icon: Truck, label: 'משאיות (C / C1)' },
    { icon: Tractor, label: 'טרקטור (1)' },
    { icon: Ship, label: 'אופנוע ים' },
  ];

  const stats = [
    { value: '6+', label: 'שנות ניסיון מקצועי' },
    { value: '5,000+', label: 'תלמידים שסיימו בהצלחה' },
    { value: '99%', label: 'אחוזי הצלחה במבחנים' },
    { value: '24/7', label: 'ליווי ותמיכה' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-200">
      {/* Hero */}
      <section className="py-20 bg-linear-to-b from-gray-200 to-gray-100 dark:from-zinc-900 dark:to-zinc-950">
        <div className="container mx-auto px-4 grid md:grid-cols-2 gap-10 items-center">
          <div className="text-center md:text-right">
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              <span className="text-primary">תיאוריה חמודי</span>
            </h1>
            <p className="text-xl text-gray-700 dark:text-zinc-400 mb-6">
              בית ספר מקצועי ללימודי תיאוריה ונהיגה
            </p>
            <p className="text-lg text-gray-700 dark:text-zinc-300 leading-relaxed">
              אנו מתמחים בהכנה מקיפה למבחני התיאוריה והנהיגה, תוך ליווי אישי,
              שיטות לימוד מתקדמות וניסיון מוכח בהובלת תלמידים להצלחה.
            </p>
          </div>

          <div className="flex justify-center">
            <Image
              src="/images/teoria-hamodi-logo.jpeg"
              alt="תיאוריה חמודי"
              width={450}
              height={450}
              className="rounded-2xl shadow-2xl border dark:border-zinc-800"
              priority
            />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y bg-gray-200 dark:bg-zinc-900 border-gray-300 dark:border-zinc-800">
        <div className="container mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="p-6 rounded-xl bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700"
            >
              <div className="text-3xl font-bold text-primary">
                {stat.value}
              </div>
              <div className="text-muted-foreground dark:text-zinc-400">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section className="py-20">
        <div className="container mx-auto px-4 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-4">מי אנחנו?</h2>
            <p className="text-gray-700 dark:text-zinc-300 mb-4 text-lg leading-relaxed">
              תיאוריה חמודי הוא מוסד לימוד מוביל בתחום התיאוריה והנהיגה בישראל,
              עם התמחות בהכנה לכל סוגי הרישיונות — מהפרטי ועד המקצועי.
            </p>
            <p className="text-gray-700 dark:text-zinc-300 mb-6 text-lg leading-relaxed">
              אנו מאמינים בשילוב בין מקצועיות, יחס אישי ולמידה חכמה, המאפשרים
              לכל תלמיד להגיע מוכן, בטוח וממוקד למבחן.
            </p>

            <div className="flex items-center gap-4">
              <Image
                src="/images/passed.jpeg"
                alt="תלמידים שעברו בהצלחה"
                width={100}
                height={100}
                className="rounded-lg bg-white p-2 dark:bg-zinc-800"
              />
              <span className="text-accent text-xl font-semibold">
                הצלחה שמדברת בעד עצמה
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 border rounded-xl bg-gray-100 dark:bg-zinc-900 border-gray-300 dark:border-zinc-800">
              <Award className="w-10 h-10 text-primary mb-3" />
              <h3 className="font-bold">איכות ללא פשרות</h3>
              <p className="text-sm text-muted-foreground dark:text-zinc-400">
                חומרי לימוד מעודכנים ותרגול ממוקד
              </p>
            </div>
            <div className="p-6 border rounded-xl bg-gray-100 dark:bg-zinc-900 border-gray-300 dark:border-zinc-800">
              <Users className="w-10 h-10 text-primary mb-3" />
              <h3 className="font-bold">צוות מנוסה</h3>
              <p className="text-sm text-muted-foreground dark:text-zinc-400">
                מורים מקצועיים עם ניסיון רב
              </p>
            </div>
            <div className="p-6 border rounded-xl bg-card col-span-2 dark:bg-zinc-900 dark:border-zinc-800">
              <Clock className="w-10 h-10 text-accent mb-3" />
              <h3 className="font-bold">גמישות מלאה</h3>
              <p className="text-sm text-muted-foreground dark:text-zinc-400">
                זמני לימוד נוחים בהתאמה אישית
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Licenses */}
      <section className="py-20 bg-gray-200 dark:bg-zinc-900">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">
            סוגי רישיונות
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {licenseTypes.map((item, i) => (
              <div
                key={i}
                className="p-6 text-center rounded-xl bg-gray-100 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 hover:scale-105 transition"
              >
                <item.icon className="w-8 h-8 mx-auto mb-3 text-primary" />
                <div className="font-semibold">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h2 className="text-3xl font-bold mb-8">יצירת קשר</h2>

          <div className="p-10 rounded-2xl bg-gray-100 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 shadow">
            <a
              href="tel:054-969-6666"
              className="flex items-center justify-center gap-4 text-4xl font-bold text-primary mb-8"
              dir="ltr"
            >
              <Phone className="w-10 h-10" />
              054-969-6666
            </a>

            <div className="flex flex-col md:flex-row justify-center gap-6 text-muted-foreground dark:text-zinc-400">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" />
                ישראל
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                ראשון–שישי | 08:00–20:00
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
