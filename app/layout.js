import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ClientProviders from './Providers/ClientProviders';
import { cookies } from 'next/headers';

export default async function RootLayout({ children }) {
  const cookieStore = await cookies();
  const lang = cookieStore.get('lang')?.value || 'HE';

  const map = {
    HE: ['he', 'rtl'],
    AR: ['ar', 'rtl'],
    EN: ['en', 'ltr'],
  };

  const [htmlLang, dir] = map[lang] || map.HE;

  return (
    <html
      lang={htmlLang}
      dir={dir}
      suppressHydrationWarning
    >
      <head>
        {/* 🔒 PRE-PAINT FLASH GUARD */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var m = document.cookie.match(/lang=([^;]+)/);
                  var lang = m ? m[1] : 'HE';
                  if (lang !== 'HE') {
                    document.documentElement.style.visibility = 'hidden';
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>

      <body>
        <ClientProviders lang={lang}>
          <Header />
          {children}
          <Footer />
        </ClientProviders>
      </body>
    </html>
  );
}
