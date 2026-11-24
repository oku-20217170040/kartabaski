'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="tr">
      <body style={{ margin: 0, background: '#F5F2EC', color: '#1B1A17', fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 24 }}>
          <div style={{ maxWidth: 480 }}>
            <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: 36, margin: '0 0 14px' }}>Bir şeyler ters gitti.</h1>
            <p style={{ color: '#55524B', fontSize: 17, margin: '0 0 28px' }}>Beklenmedik bir sorun oluştu. Sayfayı yeniden deneyebilir ya da ana sayfaya dönebilirsiniz.</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={reset}
                style={{ minHeight: 48, padding: '0 22px', border: '1px solid #1F4A36', background: '#1F4A36', color: '#fff', fontSize: 16, cursor: 'pointer', borderRadius: 4 }}
              >
                Tekrar deneyin
              </button>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                style={{ minHeight: 48, padding: '0 22px', border: '1px solid #1B1A17', color: '#1B1A17', fontSize: 16, textDecoration: 'none', borderRadius: 4, display: 'inline-flex', alignItems: 'center' }}
              >
                Ana sayfaya dön
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
