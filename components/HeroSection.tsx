'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import '@fontsource-variable/shantell-sans';
import { useEffect, useRef, useState } from 'react';
import type { Product } from '@/types';
import MugPreview, { MugPreviewHandle, PrintFont } from '@/components/MugPreview';
import PhotoControls from '@/components/PhotoControls';
import { CartIcon } from '@/components/cart/CartLink';
import { VITRIN_MUGS } from '@/lib/vitrin';
import { useCart } from '@/lib/cart-context';
import { saveFile } from '@/lib/cart-files';
import { productToCartItem } from '@/lib/cart-products';
import { isUsableImage, prepareUpload } from '@/lib/siparis-client';
import { usePrintPhoto } from '@/lib/use-print-photo';
import { trackEvent } from '@/lib/analytics-client';

const MAX_LEN = 40;
const SAMPLE = 'Önce kahve';

interface Props {
  lowestPrice?: number | null;
  /** Fotoğraftaki kupanın katalog kaydı (varsa). */
  mugProduct?: { slug: string; title: string; price: string; product: Product } | null;
}

export default function HeroSection({ lowestPrice, mugProduct }: Props) {
  const router = useRouter();
  const cart = useCart();
  const preview = useRef<MugPreviewHandle>(null);
  const [text, setText] = useState('');
  const [colorIndex, setColorIndex] = useState(0);
  const [font, setFont] = useState<PrintFont>('duz');
  const [file, setFile] = useState<File | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const print = usePrintPhoto(file);

  // Diğer renkler tıklanınca beklemesin.
  useEffect(() => {
    const timer = setTimeout(() => {
      VITRIN_MUGS.slice(1).forEach((m) => { new window.Image().src = `/vitrin/${m.file}.webp`; });
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const pickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    setError('');
    // Bozuk dosya sepete girmesin diye seçilirken denenir.
    if (await isUsableImage(picked).catch(() => false)) setFile(picked);
    else setError('Bu dosya açılamadı. JPG veya PNG bir fotoğraf deneyin.');
  };

  const mug = VITRIN_MUGS[colorIndex];
  const printed = text || (file ? '' : SAMPLE);
  const personalised = Boolean(text.trim() || file);

  const addToCart = async () => {
    if (!mugProduct) return;
    setAdding(true);
    setError('');
    try {
      const photos = file ? [await saveFile(await prepareUpload(file))] : [];
      const shot = await preview.current?.snapshot(mug.field);
      cart.save(productToCartItem(mugProduct.product, {
        color: mug.color,
        design: {
          photos,
          preview: shot ? await saveFile(shot) : undefined,
          text: text.trim() || undefined,
          font: text.trim() ? font : undefined,
          placement: file ? print.placement : undefined,
          removeBg: file && print.removeBg ? true : undefined,
        },
      }));
      trackEvent('cart_add', { slug: mugProduct.slug, qty: 1 });
      router.push('/sepet');
    } catch {
      setError('Sepete eklenemedi. Tarayıcınız gizli moddaysa fotoğraf saklanamayabilir.');
      setAdding(false);
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
            photo={print.image}
            placement={print.placement}
            onPlacementChange={print.setPlacement}
          />
          {!file && mugProduct && (
            <p className="vitrin-caption">
              <Link href={`/urun/${mugProduct.slug}`}>{mugProduct.title}, {mugProduct.price}</Link>
            </p>
          )}
          {file && (
            <PhotoControls
              placement={print.placement}
              onChange={print.setPlacement}
              removeBg={print.removeBg}
              removing={print.removing}
              onToggleBg={print.toggleBackground}
              onRemove={() => setFile(null)}
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
              {file ? 'Fotoğrafı değiştir' : 'Fotoğraf ekleyin'}
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

          <p className="vitrin-error" role="alert">{error || print.error}</p>

          <div className="vitrin-ctas">
            {mugProduct && personalised ? (
              <button type="button" className="btn vitrin-order" onClick={addToCart} disabled={adding || print.removing}>
                <CartIcon size={18} /> {adding ? 'Ekleniyor…' : 'Sepete ekle'}
              </button>
            ) : (
              <Link className="btn vitrin-order" href={mugProduct ? `/tasarla/${mugProduct.slug}?renk=${encodeURIComponent(mug.color)}` : '#urunler'}>
                <CartIcon size={18} /> Tasarlamaya başlayın
              </Link>
            )}
            <Link className="text-link" href="#urunler">Bütün kupalar</Link>
          </div>

          <p className="vitrin-facts">
            Tek adet de basıyoruz, iki yüzüne ayrı fotoğraf da. Basmadan önce nasıl duracağını gönderiyoruz, onayınızdan sonra 3 iş gününde kargoda.
            {lowestPrice ? ` Kupalar ${lowestPrice.toLocaleString('tr-TR')}₺’den başlıyor.` : ''}
          </p>
        </div>
      </div>
    </section>
  );
}
