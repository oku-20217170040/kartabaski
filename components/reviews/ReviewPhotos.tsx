'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cloudinaryUrl } from '@/lib/format';
import { stars } from '@/lib/reviews-utils';

export interface ReviewCaption {
  rating: number;
  text: string;
  by: string;
  product?: string;
}

const BIG = 'f_auto,q_auto,w_1600,c_limit';
const THUMB = 'f_auto,q_auto,w_240,h_240,c_fill';
const SWIPE_PX = 48;

function Lightbox({ images, start, alt, caption, onClose }: {
  images: string[];
  start: number;
  alt: string;
  caption?: ReviewCaption;
  onClose: () => void;
}) {
  const [i, setI] = useState(start);
  const touchX = useRef<number | null>(null);
  const n = images.length;
  const go = useCallback((d: number) => setI((c) => (c + d + n) % n), [n]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; // arkadaki sayfa kaymasın
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);

  // Yanındaki fotoğrafı önceden indir: geçiş anında bekleme olmasın
  useEffect(() => {
    if (n < 2) return;
    [1, -1].forEach((d) => {
      const img = new window.Image();
      img.src = cloudinaryUrl(images[(i + d + n) % n], BIG);
    });
  }, [i, images, n]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Müşteri fotoğrafları"
      className="rv-lb"
      onClick={onClose}
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => {
        const x0 = touchX.current;
        touchX.current = null;
        if (x0 === null || n < 2) return;
        const dx = e.changedTouches[0].clientX - x0;
        if (Math.abs(dx) > SWIPE_PX) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="rv-lb-top">
        <span>{n > 1 ? `${i + 1} / ${n}` : ''}</span>
        <button type="button" className="rv-lb-close" aria-label="Kapat" onClick={(e) => { e.stopPropagation(); onClose(); }}>×</button>
      </div>

      <div className="rv-lb-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={images[i]}
          className="rv-lb-img"
          src={cloudinaryUrl(images[i], BIG)}
          alt={`${alt} (${i + 1}/${n})`}
          onClick={(e) => e.stopPropagation()}
          draggable={false}
        />
        {n > 1 && (
          <>
            <button type="button" className="rv-lb-nav prev" aria-label="Önceki fotoğraf" onClick={(e) => { e.stopPropagation(); go(-1); }}>‹</button>
            <button type="button" className="rv-lb-nav next" aria-label="Sonraki fotoğraf" onClick={(e) => { e.stopPropagation(); go(1); }}>›</button>
          </>
        )}
      </div>

      <div className="rv-lb-bottom" onClick={(e) => e.stopPropagation()}>
        {n > 1 && (
          <div className="rv-lb-thumbs">
            {images.map((id, k) => (
              <button
                key={id}
                type="button"
                className="rv-lb-thumb"
                aria-label={`${k + 1}. fotoğraf`}
                aria-current={k === i}
                onClick={() => setI(k)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cloudinaryUrl(id, THUMB)} alt="" width={52} height={52} />
              </button>
            ))}
          </div>
        )}
        {caption && (
          <div className="rv-lb-caption">
            <span className="rv-stars" aria-label={`${caption.rating} yıldız`}>{stars(caption.rating)}</span>{' '}
            <strong>{caption.by}</strong>
            {caption.product ? <span style={{ opacity: 0.7 }}> · {caption.product}</span> : null}
            {caption.text ? <p>{caption.text}</p> : null}
          </div>
        )}
      </div>
    </div>
  );
}

/** Yorum fotoğrafları: küçük resimler, tıklayınca tam ekran galeri (kaydırma/ok/klavye ile geçiş). */
export default function ReviewPhotos({
  images,
  alt,
  caption,
  size = 84,
  firstOnly = false,
}: {
  images: string[];
  alt: string;
  caption?: ReviewCaption;
  size?: number;
  /** true: yalnızca ilk küçük resim görünür, fazlası "+N" rozetiyle; tıklayınca tüm galeri açılır */
  firstOnly?: boolean;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  if (!images.length) return null;
  const shown = firstOnly ? images.slice(0, 1) : images;
  return (
    <>
      <div className="rv-photos">
        {shown.map((id, k) => (
          <button
            key={id}
            type="button"
            className="rv-photo"
            onClick={() => setOpen(k)}
            aria-label={`Fotoğrafı büyüt (${k + 1}/${images.length})`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="rv-photo-img"
              src={cloudinaryUrl(id, THUMB)}
              alt={alt}
              width={size}
              height={size}
              loading="lazy"
              style={{ width: size, height: size }}
            />
            {firstOnly && images.length > 1 && <span className="rv-photo-more">+{images.length - 1}</span>}
          </button>
        ))}
      </div>
      {open !== null && <Lightbox images={images} start={open} alt={alt} caption={caption} onClose={close} />}
    </>
  );
}
