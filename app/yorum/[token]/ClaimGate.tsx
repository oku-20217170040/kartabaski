'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { claimInviteAction } from '@/lib/actions-reviews';

/**
 * Bağlantı ilk kez açıldığında tarayıcıdan sahiplenir (JS gerektirir: WhatsApp önizleme botu bağlantıyı tüketemez).
 * Sahiplenince sayfayı yeniler; sunucu formu gösterir.
 */
export default function ClaimGate({ token }: { token: string }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    claimInviteAction(token)
      .then((access) => (access === 'ok' ? router.refresh() : setFailed(true)))
      .catch(() => setFailed(true));
  }, [token, router]);
  if (failed) {
    return (
      <p className="rv-msg" role="alert">
        Bu bağlantı açılamadı. Sayfayı yenileyin; olmazsa KAR-TA BASKI&apos;den yeni bağlantı isteyebilirsiniz.
      </p>
    );
  }
  return <p className="rv-wait">Yükleniyor…</p>;
}
