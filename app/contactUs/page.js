"use client";

import { Phone, MapPin, Clock } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-900 text-gray-100">
      {/* Centered Content */}
      <main className="grow flex items-center justify-center">
        <section className="w-full max-w-md px-4 text-center">
          <h1 className="text-3xl font-bold mb-4">יצירת קשר</h1>

          <p className="text-gray-400 mb-6 text-base">
            נשמח לענות על כל שאלה וללוות אתכם בדרך להצלחה
          </p>

          <div className="rounded-xl bg-gray-800 border border-gray-700 shadow p-5 space-y-4">
            {/* Phone */}
            <a
              href="tel:054-969-6666"
              className="flex items-center justify-center gap-3 text-2xl font-bold text-primary hover:opacity-80 transition"
              dir="ltr"
            >
              <Phone className="w-6 h-6" />
              054-969-6666
            </a>

            {/* Info */}
            <div className="flex flex-col gap-2 text-gray-400 text-sm">
              <div className="flex items-center justify-center gap-2">
                <MapPin className="w-4 h-4 text-primary" />
                ישראל
              </div>

              <div className="flex items-center justify-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                ראשון–שישי | 08:00–20:00
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
