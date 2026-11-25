import type { Metadata } from 'next';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { getInvite, inviteCookieHash } from '@/lib/reviews';
import { inviteAccess, TOKEN_RE } from '@/lib/reviews-utils';
import '@/components/reviews/reviews.css';
import ReviewForm from './ReviewForm';
import ClaimGate from './ClaimGate';

// Kişiye özel tek kullanımlık bağlantı: önbelleğe alınmaz, arama motorlarına kapalı.
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Yorumunuzu yazın', robots: { index: false, follow: false } };

const MESSAGES: Record<string, string> = {
  missing: 'Bu bağlantı geçersiz. Yorum bağlantısını KAR-TA BASKI\'den yeniden isteyebilirsiniz.',
  used: 'Bu bağlantıyla zaten yorum yazılmış. Teşekkür ederiz!',
  expired: 'Bu bağlantının süresi dolmuş. Yeni bir bağlantı için KAR-TA BASKI\'ye yazabilirsiniz.',
  locked: 'Bu bağlantı başka bir cihazda açılmış. Yorumu, bağlantıyı ilk açtığınız cihazdan yazabilirsiniz.',
};

export default async function ReviewPage({ params }: { params: { token: string } }) {
  const invite = await getInvite(params.token).catch(() => null);
  const state = inviteAccess(invite, TOKEN_RE.test(params.token) ? inviteCookieHash(params.token) : null);

  return (
    <>
      <Navbar />
      <main className="rv-page">
        {state === 'unclaimed' ? (
          <ClaimGate token={params.token} />
        ) : state === 'ok' && invite ? (
          <>
            <h1 className="rv-page-title">Deneyiminizi paylaşın</h1>
            <p className="rv-lead">
              {invite.productTitle ? (
                <>
                  <strong>{invite.productTitle}</strong> siparişiniz için teşekkür ederiz.
                </>
              ) : (
                'Siparişiniz için teşekkür ederiz.'
              )}{' '}
              Dürüst yorumunuz diğer müşterilere yardımcı olur.
            </p>
            <ReviewForm token={params.token} />
          </>
        ) : (
          <p className="rv-msg">{MESSAGES[state] ?? MESSAGES.missing}</p>
        )}
      </main>
      <Footer />
    </>
  );
}
