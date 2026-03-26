'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';
import { WHATSAPP_BASE } from '@/lib/constants';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="tr">
      <body style={{ margin: 0, background: 'var(--bg, #0b0f14)', color: 'var(--text, #e8eaf0)', fontFamily: 'Inter, sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', padding: '60px 24px', maxWidth: 500 }}>
            <div style={{ fontSize: '5rem', marginBottom: 8 }}>⚠️</div>
            <h1 style={{ fontFamily: 'Outfit, sans-serif', fontSize: 'clamp(1.4rem, 3vw, 2rem)', marginBottom: 12 }}>
              Bir hata oluştu
            </h1>
            <p style={{ color: '#8899aa', fontSize: 15, marginBottom: 40 }}>
              Beklenmedik bir sorun yaşandı. Sayfayı yenilemeyi veya ana sayfaya dönmeyi deneyin.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={reset}
                style={{
                  padding: '10px 24px', borderRadius: 8, border: '1px solid #2f81f7',
                  background: '#2f81f7', color: '#fff', cursor: 'pointer', fontSize: 14,
                }}
              >
                Tekrar Dene
              </button>
              <Link
                href="/"
                style={{
                  padding: '10px 24px', borderRadius: 8, border: '1px solid #2a3444',
                  background: 'transparent', color: '#e8eaf0', textDecoration: 'none', fontSize: 14,
                }}
              >
                Ana Sayfa
              </Link>
              <a
                href={`${WHATSAPP_BASE}?text=Sitede%20bir%20hata%20olu%C5%9Ftu%2C%20yard%C4%B1m%20edebilir%20misiniz%3F`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '10px 24px', borderRadius: 8, border: '1px solid #25D366',
                  background: 'transparent', color: '#25D366', textDecoration: 'none', fontSize: 14,
                }}
              >
                WhatsApp ile Bildir
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
