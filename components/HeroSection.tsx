'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import '@fontsource-variable/shantell-sans';
import { useEffect, useRef, useState } from 'react';
import { WhatsAppIcon } from '@/components/icons';
import MugPreview, { MugPreviewHandle, PrintFont } from '@/components/MugPreview';
import PhotoControls from '@/components/PhotoControls';
import { VITRIN_MUGS, VITRIN_PRODUCT_SLUG, vitrinOrderText } from '@/lib/vitrin';
import { DEFAULT_PLACEMENT, Placement } from '@/lib/photo-layout';
import { removeBackground } from '@/lib/remove-background';
import { createDesignRequest } from '@/lib/design-client';
import { WHATSAPP_BASE } from '@/lib/constants';

const MAX_LEN = 40;
const SAMPLE = 'Önce kahve';

interface Props {
  lowestPrice?: number | null;
  /** Fotoğraftaki kupanın katalog kaydı (varsa). */
  mugProduct?: { href: string; title: string; price: string } | null;
}

interface Photo {
  file: File;
  original: HTMLImageElement;
  cutout?: HTMLImageElement;
}

const release = (p: Photo | null) => {
  if (!p) return;
  URL.revokeObjectURL(p.original.src);
  if (p.cutout) URL.revokeObjectURL(p.cutout.src);
};

export default function HeroSection({ lowestPrice, mugProduct }: Props) {
  const router = useRouter();
  const preview = useRef<MugPreviewHandle>(null);
  const [text, setText] = useState('');
  const [colorIndex, setColorIndex] = useState(0);
  const [font, setFont] = useState<PrintFont>('duz');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [placement, setPlacement] = useState<Placement>(DEFAULT_PLACEMENT);
  const [removeBg, setRemoveBg] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const photoRef = useRef<Photo | null>(null);
  photoRef.current = photo;

  // Fotoğraf, sipariş hazırlanana kadar yalnızca tarayıcıda durur.
  useEffect(() => () => release(photoRef.current), []);

  // Diğer renkler tıklanınca beklemesin.
  useEffect(() => {
    const timer = setTimeout(() => {
      VITRIN_MUGS.slice(1).forEach((m) => { new window.Image().src = `/vitrin/${m.file}.webp`; });
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const setNewPhoto = (next: Photo | null) => {
    release(photo);
    setPhoto(next);
    setPlacement(DEFAULT_PLACEMENT);
    setRemoveBg(false);
    setError('');
  };

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const img = new window.Image();
    img.onload = () => setNewPhoto({ file, original: img });
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      setError('Bu dosya açılamadı. JPG veya PNG bir fotoğraf deneyin.');
    };
    img.src = URL.createObjectURL(file);
  };

  const toggleBackground = async () => {
    if (!photo) return;
    setError('');
    if (removeBg) { setRemoveBg(false); return; }
    if (photo.cutout) { setRemoveBg(true); return; }
    setRemoving(true);
    try {
      const cutout = await removeBackground(photo.original);
      // İşlem sürerken fotoğraf değiştirildiyse sonucu at.
      if (photoRef.current?.original !== photo.original) { URL.revokeObjectURL(cutout.src); return; }
      setPhoto({ ...photo, cutout });
      setRemoveBg(true);
    } catch {
      setError('Arka plan silinemedi. Siparişte belirtirseniz biz sileriz.');
    } finally {
      setRemoving(false);
    }
  };

  const mug = VITRIN_MUGS[colorIndex];
  const printed = text || (photo ? '' : SAMPLE);
  const shown = photo ? (removeBg && photo.cutout ? photo.cutout : photo.original) : null;
  const orderText = vitrinOrderText({ text, color: mug.color, handwriting: font === 'el', hasPhoto: Boolean(photo) });
  const waHref = `${WHATSAPP_BASE}?text=${encodeURIComponent(orderText)}`;

  const prepareOrder = async () => {
    setSending(true);
    setError('');
    try {
      // Örnek yazı siparişe girmez: kullanıcı bir şey yazmadıysa önizleme gönderilmez.
      const personalised = Boolean(text.trim() || photo);
      const snapshot = personalised ? await preview.current?.snapshot(mug.field) : null;
      const token = await createDesignRequest(
        {
          productSlug: VITRIN_PRODUCT_SLUG,
          color: mug.color,
          text: text.trim() || undefined,
          font: text.trim() ? font : undefined,
          placement: photo ? placement : undefined,
          removeBg: photo ? removeBg : undefined,
        },
        snapshot,
        photo?.file,
      );
      router.push(`/tasarim/${token}?musteri=1`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sipariş hazırlanamadı.');
      setSending(false);
    }
  };

  return (
    <section
      className="vitrin"
      aria-labelledby="vitrin-baslik"
      style={{ ['--field' as string]: mug.field, ['--on-field' as string]: mug.onField }}
    >
      <div className="wrap vitrin-grid">
        <h1 id="vitrin-baslik" className="vitrin-title">
          <span>Kupanıza</span> <span>ne yazalım?</span>
        </h1>

        <div className="vitrin-stage">
          <MugPreview
            ref={preview}
            mug={mug}
            text={printed}
            font={font}
            photo={shown}
            placement={placement}
            onPlacementChange={setPlacement}
          />
          {!photo && mugProduct && (
            <p className="vitrin-caption">
              <Link href={mugProduct.href}>{mugProduct.title}, {mugProduct.price}</Link>
            </p>
          )}
          {photo && (
            <PhotoControls
              placement={placement}
              onChange={setPlacement}
              removeBg={removeBg}
              removing={removing}
              onToggleBg={toggleBackground}
              onRemove={() => setNewPhoto(null)}
            />
          )}
        </div>

        <div className="vitrin-form">
          <label className="vitrin-label" htmlFor="vitrin-metin">Yazın, kupanın üstünde görün</label>
          <span className="vitrin-input">
            <input
              id="vitrin-metin"
              type="text"
              value={text}
              maxLength={MAX_LEN}
              placeholder="İyi ki doğdun Elif"
              onChange={(e) => setText(e.target.value)}
              autoComplete="off"
              enterKeyHint="done"
            />
            <span className="vitrin-count" aria-hidden="true">{text.length}/{MAX_LEN}</span>
          </span>

          <div className="vitrin-tools">
            <button type="button" className="vitrin-tool" aria-pressed={font === 'duz'} onClick={() => setFont('duz')}>
              Düz yazı
            </button>
            <button type="button" className="vitrin-tool is-hand" aria-pressed={font === 'el'} onClick={() => setFont('el')}>
              El yazısı
            </button>
            <label className="vitrin-tool vitrin-file">
              {photo ? 'Fotoğrafı değiştir' : 'Fotoğraf ekleyin'}
              <input type="file" accept="image/*" className="sr-only" onChange={pickPhoto} />
            </label>
          </div>

          <div className="vitrin-colors">
            <p id="vitrin-renk">Kulp rengi: <b>{mug.color}</b></p>
            <div role="radiogroup" aria-labelledby="vitrin-renk" className="vitrin-swatches">
              {VITRIN_MUGS.map((m, i) => (
                <button
                  key={m.file}
                  type="button"
                  role="radio"
                  aria-checked={colorIndex === i}
                  aria-label={m.color}
                  title={m.color}
                  className="vitrin-swatch"
                  onClick={() => setColorIndex(i)}
                >
                  <i style={{ background: m.handle }} />
                </button>
              ))}
            </div>
          </div>

          <p className="vitrin-error" role="alert">{error}</p>

          <div className="vitrin-ctas">
            {mugProduct ? (
              <button type="button" className="btn vitrin-order" onClick={prepareOrder} disabled={sending || removing}>
                <WhatsAppIcon /> {sending ? 'Hazırlanıyor…' : 'Siparişi hazırlayın'}
              </button>
            ) : (
              <a className="btn vitrin-order" href={waHref} target="_blank" rel="noopener noreferrer">
                <WhatsAppIcon /> WhatsApp&apos;tan sipariş edin
              </a>
            )}
            <Link className="text-link" href="#urunler">Bütün kupalar</Link>
          </div>

          {mugProduct && (
            <p className="vitrin-note">
              Sonraki adımda başka fotoğraflar ve not ekleyip WhatsApp&apos;tan gönderirsiniz. Fotoğrafınız bu düğmeye basana kadar cihazınızda kalır.
            </p>
          )}

          <p className="vitrin-facts">
            Tek adet de basıyoruz. Basmadan önce nasıl duracağını gönderiyoruz, onayınızdan sonra 3 iş gününde kargoda.
            {lowestPrice ? ` Kupalar ${lowestPrice.toLocaleString('tr-TR')}₺’den başlıyor.` : ''}
          </p>
        </div>
      </div>
    </section>
  );
}
