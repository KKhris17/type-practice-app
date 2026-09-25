import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import '@/frontend/globals.css';

const CLIENT_RECOVERY_SCRIPT = `
(() => {
  const recoveryKey = 'type-practice-client-recovery-at';

  const recover = () => {
    const now = Date.now();
    const previousAttempt = Number(sessionStorage.getItem(recoveryKey) || 0);
    if (now - previousAttempt < 10000) return;

    sessionStorage.setItem(recoveryKey, String(now));
    window.setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('recover', String(Date.now()));
      window.location.replace(url);
    }, 750);
  };

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    recover();
  });

  window.addEventListener('unhandledrejection', (event) => {
    const message = String(event.reason?.message || event.reason || '');
    if (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message)) {
      event.preventDefault();
      recover();
    }
  });

  window.addEventListener('error', (event) => {
    const target = event.target;
    if (target instanceof HTMLScriptElement && target.src.startsWith(window.location.origin)) {
      recover();
    }
  }, true);
})();
`;

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Type Practice — deliberate typing training',
  description:
    'A local-first typing workspace for source-grounded practice passages and adaptive weakness drills.',
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <script dangerouslySetInnerHTML={{ __html: CLIENT_RECOVERY_SCRIPT }} />
        <output id="startup-guard" aria-live="polite">
          <div className="startup-guard-card">
            <p className="startup-guard-kicker">LOCAL STARTUP</p>
            <h1>Type Practice is still starting</h1>
            <p>
              Wait until Terminal shows{' '}
              <strong>Local: http://localhost:3000/</strong>, then reload this
              page.
            </p>
            {/* oxlint-disable-next-line next/no-html-link-for-pages -- This link must work before React hydrates. */}
            <a href="/?reload=1">Reload Type Practice</a>
          </div>
        </output>
        {children}
      </body>
    </html>
  );
}
