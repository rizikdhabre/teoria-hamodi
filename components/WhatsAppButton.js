'use client';

import { FaWhatsapp } from 'react-icons/fa';

export default function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/972549696666"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="
        fixed bottom-6 left-6 z-50
        bg-green-500 hover:bg-green-600
        text-white rounded-full
        p-4 shadow-lg
        flex items-center justify-center
      "
    >
      <FaWhatsapp size={28} />
    </a>
  );
}
