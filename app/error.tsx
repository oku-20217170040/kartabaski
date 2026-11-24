'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import * as Sentry from '@sentry/nextjs';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: Props) {
  useEffect(() => {
    console.error(error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <main id="icerik">
      <div className="wrap">
        <div className="notice">
          <div>
            <p className="eyebrow">Hata</p>
            <h1 className="display">Bir şeyler ters gitti.</h1>
            <p className="lead">Beklenmedik bir sorun oluştu. Sayfayı yeniden deneyebilir ya da ana sayfaya dönebilirsiniz.</p>
            <div className="hero-ctas">
              <button type="button" className="btn btn-primary" onClick={reset}>Tekrar deneyin</button>
              <Link href="/" className="btn btn-outline">Ana sayfaya dön</Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
