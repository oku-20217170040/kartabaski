'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon, ZoomIcon } from '@/components/icons';
import { cloudinaryUrl } from '@/lib/format';

/* Kırpma yok: farklı oranlardaki fotoğraflar kenar rengiyle 4:5'e tamamlanır. */
const MAIN_TRANSFORM = 'f_auto,q_auto,w_1080,ar_4:5,c_pad,b_auto:border';
const FULL_TRANSFORM = 'f_auto,q_auto,w_1600,c_limit';
const THUMB_TRANSFORM = 'f_auto,q_auto,w_160,h_200,c_pad,b_auto:border';

const toSrc = (id: string, opts: string) => (id.startsWith('http') ? id : cloudinaryUrl(id, opts));

/** Yana kaydırılan şerit: parmakla doğal kayar, düğme ve küçük resimlerle de gidilir. */
function useSlider(count: number, initial = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(initial);

  const goTo = useCallback((i: number, behavior: ScrollBehavior = 'smooth') => {
    const el = ref.current;
    if (!el || !count) return;
    const next = (i + count) % count;
    el.scrollTo({ left: next * el.clientWidth, behavior });
    setIndex(next);
  }, [count]);

  const onScroll = () => {
    const el = ref.current;
    if (!el || !el.clientWidth) return;
    setIndex(Math.max(0, Math.min(count - 1, Math.round(el.scrollLeft / el.clientWidth))));
  };

  return { ref, index, goTo, onScroll };
}

function Thumbs({ ids, index, onPick, className }: { ids: string[]; index: number; onPick: (i: number) => void; className: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // Seçili küçük resim görünür kalsın (sayfayı dikey kaydırmadan).
  useEffect(() => {
    const strip = ref.current;
    const item = strip?.children[index] as HTMLElement | undefined;
    if (!strip || !item) return;
    strip.scrollTo({ left: item.offsetLeft - strip.offsetLeft - (strip.clientWidth - item.clientWidth) / 2, behavior: 'smooth' });
  }, [index]);

  return (
    <div className={className} ref={ref}>
      {ids.map((id, i) => (
        <button
          key={`${id}-${i}`}
          type="button"
          className="gal-thumb"
          aria-current={i === index}
          aria-label={`Görsel ${i + 1}`}
          onClick={() => onPick(i)}
        >
          <Image src={toSrc(id, THUMB_TRANSFORM)} alt="" width={160} height={200} />
        </button>
      ))}
    </div>
  );
}

function Viewer({ ids, title, start, onClose }: { ids: string[]; title: string; start: number; onClose: (i: number) => void }) {
  const { ref, index, goTo, onScroll } = useSlider(ids.length, start);
  const closeRef = useRef<HTMLButtonElement>(null);
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    const lastFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    goTo(start, 'instant');
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      lastFocus?.focus?.({ preventScroll: true });
    };
    // Yalnızca açılışta çalışır.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose(indexRef.current);
      else if (e.key === 'ArrowRight') goTo(indexRef.current + 1);
      else if (e.key === 'ArrowLeft') goTo(indexRef.current - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, onClose]);

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={`${title} görselleri`}>
      <div className="viewer-bar">
        <button ref={closeRef} type="button" className="viewer-close" onClick={() => onClose(index)} aria-label="Kapat">
          <CloseIcon size={26} />
        </button>
        <span className="viewer-count" aria-live="polite">{index + 1}/{ids.length}</span>
      </div>

      <div className="viewer-stage">
        <div className="gal-track" ref={ref} onScroll={onScroll}>
          {ids.map((id, i) => (
            <div className="gal-slide" key={`${id}-${i}`}>
              {/* Komşu görseller önceden insin; kaydırınca boş ekran görünmesin. */}
              <Image src={toSrc(id, FULL_TRANSFORM)} alt={`${title}, görsel ${i + 1}`} fill sizes="100vw" loading={Math.abs(i - index) <= 1 ? 'eager' : 'lazy'} />
            </div>
          ))}
        </div>
        {ids.length > 1 && (
          <>
            <button type="button" className="icon-btn nav-arrow prev" onClick={() => goTo(index - 1)} aria-label="Önceki görsel">
              <ChevronLeftIcon />
            </button>
            <button type="button" className="icon-btn nav-arrow next" onClick={() => goTo(index + 1)} aria-label="Sonraki görsel">
              <ChevronRightIcon />
            </button>
          </>
        )}
      </div>

      {ids.length > 1 && <Thumbs ids={ids} index={index} onPick={(i) => goTo(i)} className="viewer-thumbs" />}
    </div>
  );
}

export default function ProductGallery({ ids, title }: { ids: string[]; title: string }) {
  const count = ids.length;
  const { ref, index, goTo, onScroll } = useSlider(count);
  const [viewer, setViewer] = useState<number | null>(null);

  const close = useCallback((i: number) => {
    setViewer(null);
    goTo(i, 'instant');
  }, [goTo]);

  return (
    <div className="pdp-gallery">
      <div className="gal-main">
        <div className="gal-track" ref={ref} onScroll={onScroll}>
          {ids.map((id, i) => (
            <button
              type="button"
              className="gal-slide"
              key={`${id}-${i}`}
              onClick={() => setViewer(i)}
              aria-label={`Görsel ${i + 1}, büyütmek için dokunun`}
              tabIndex={i === index ? 0 : -1}
            >
              <Image
                src={toSrc(id, MAIN_TRANSFORM)}
                alt={`${title}, görsel ${i + 1}`}
                fill
                sizes="(max-width: 960px) 100vw, 45vw"
                priority={i === 0}
              />
            </button>
          ))}
        </div>

        {count > 1 && (
          <>
            <button type="button" className="icon-btn nav-arrow prev" onClick={() => goTo(index - 1)} aria-label="Önceki görsel">
              <ChevronLeftIcon />
            </button>
            <button type="button" className="icon-btn nav-arrow next" onClick={() => goTo(index + 1)} aria-label="Sonraki görsel">
              <ChevronRightIcon />
            </button>
            {/* Çok fotoğrafta nokta yerine sayaç: noktalar dar ekrana sığmaz. */}
            <div className="gal-dots" aria-hidden="true">
              {count <= 10
                ? ids.map((id, i) => <i key={`${id}-${i}`} className={i === index ? 'on' : undefined} />)
                : <span>{index + 1}/{count}</span>}
            </div>
          </>
        )}
        {count > 0 && (
          <button type="button" className="icon-btn gal-zoom" onClick={() => setViewer(index)} aria-label="Görseli büyüt">
            <ZoomIcon />
          </button>
        )}
      </div>

      {count > 1 && <Thumbs ids={ids} index={index} onPick={(i) => goTo(i)} className="gal-thumbs" />}

      {viewer !== null && <Viewer ids={ids} title={title} start={viewer} onClose={close} />}
    </div>
  );
}
