'use client';

import { useState } from 'react';
import { submitReviewAction } from '@/lib/actions-reviews';
import { cloudinaryUrl } from '@/lib/format';
import { MAX_REVIEW_IMAGES, SATISFACTION } from '@/lib/reviews-utils';
import { IconCamera, IconCheck, IconClose } from '@/components/admin/icons';
import { compressImage } from '@/components/reviews/compress';

export default function ReviewForm({ token }: { token: string }) {
  const [name, setName] = useState('');
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_REVIEW_IMAGES - images.length);
    e.target.value = '';
    if (!files.length) return;
    setError('');
    setUploading(true);
    try {
      const added: string[] = [];
      for (const original of files) {
        const file = await compressImage(original); // telefon fotoğrafları büyüktür: yüklemeden önce küçült
        const fd = new FormData();
        fd.append('file', file);
        fd.append('token', token);
        const res = await fetch('/api/upload-review', { method: 'POST', body: fd });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.public_id) {
          setError(json.error || 'Fotoğraf yüklenemedi.');
          break;
        }
        added.push(json.public_id);
      }
      if (added.length) setImages((cur) => [...cur, ...added].slice(0, MAX_REVIEW_IMAGES));
    } catch {
      setError('Fotoğraf yüklenemedi, bağlantınızı kontrol edin.');
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || uploading || rating === 0) return;
    setError('');
    setBusy(true);
    try {
      const res = await submitReviewAction({ token, name, rating, text, images, website });
      if (res.ok) setDone(true);
      else setError(res.error || 'Gönderilemedi.');
    } catch {
      setError('Bağlantı hatası, tekrar deneyin.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rv-done">
        <div className="rv-done-icon" aria-hidden="true"><IconCheck size={28} /></div>
        <h2>Teşekkürler!</h2>
        <p>Yorumunuz alındı. İnceleme sonrası sitemizde yayınlanacak.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rv-form">
      <div className="rv-field">
        <span className="rv-label" id="rv-rating-label">Memnuniyetiniz</span>
        <div role="radiogroup" aria-labelledby="rv-rating-label" className="rv-rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} yıldız`}
              className="rv-star-btn"
              onClick={() => setRating(n)}
            >★</button>
          ))}
        </div>
        <div className="rv-rating-label">{rating ? SATISFACTION[rating] : 'Yıldıza dokunarak puan verin'}</div>
      </div>

      <div className="rv-field">
        <label htmlFor="rv-name" className="rv-label">Adınız</label>
        <input id="rv-name" className="rv-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="name" required />
        <span className="rv-hint">Sitede ad ve soyadınızın baş harfi görünür.</span>
      </div>

      <div className="rv-field">
        <label htmlFor="rv-text" className="rv-label">Yorumunuz</label>
        <textarea
          id="rv-text"
          className="rv-input rv-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={600}
          required
          placeholder="Ürün baskı kalitesi, teslimat ve iletişim hakkında deneyiminizi yazın."
        />
        <span className="rv-hint">Telefon, adres veya bağlantı yazmayın. {text.length}/600</span>
      </div>

      <div className="rv-field">
        <span className="rv-label">Fotoğraf ekleyin (isteğe bağlı, en fazla {MAX_REVIEW_IMAGES})</span>
        <div className="rv-photo-row">
          {images.map((id) => (
            <div key={id} className="rv-thumb">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cloudinaryUrl(id, 'f_auto,q_auto,w_200,h_200,c_fill')} alt="Eklenen fotoğraf" width={84} height={84} />
              <button type="button" className="rv-thumb-remove" aria-label="Fotoğrafı kaldır" onClick={() => setImages((cur) => cur.filter((x) => x !== id))}>
                <span><IconClose size={14} /></span>
              </button>
            </div>
          ))}
          {images.length < MAX_REVIEW_IMAGES && (
            <label className="rv-add" aria-disabled={uploading}>
              <span>
                <IconCamera size={22} />
                <br />
                {uploading ? 'Yükleniyor…' : 'Fotoğraf'}
              </span>
              <input
                type="file"
                className="rv-file"
                accept="image/jpeg,image/png,image/webp,image/*"
                multiple
                disabled={uploading}
                onChange={onPickFiles}
              />
            </label>
          )}
        </div>
        <span className="rv-hint">Ürünü teslim aldığınız hâli yeterli. Yüz veya kişisel bilgi içeren fotoğraf eklemeyin; fotoğraflar yayınlanmadan önce incelenir.</span>
      </div>

      {/* Honeypot: gerçek kullanıcı görmez */}
      <input className="rv-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} />

      {error && <p role="alert" className="rv-error">{error}</p>}
      <button type="submit" className="rv-submit" disabled={busy || uploading || rating === 0}>
        {busy ? 'Gönderiliyor…' : 'Yorumu gönder'}
      </button>
    </form>
  );
}
