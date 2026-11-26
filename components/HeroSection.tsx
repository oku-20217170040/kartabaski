'use client';

import Link from 'next/link';
import '@fontsource-variable/shantell-sans';
import { useEffect, useState } from 'react';
import { WhatsAppIcon, CloseIcon } from '@/components/icons';
import MugPreview, { PrintFont } from '@/components/MugPreview';
import { VITRIN_MUGS, vitrinOrderText } from '@/lib/vitrin';
import { WHATSAPP_BASE } from '@/lib/constants';

const MAX_LEN = 40;
const SAMPLE = 'Önce kahve';

interface Props {
  lowestPrice?: number | null;
  /** Fotoğraftaki kupanın katalog kaydı (varsa). */
  mugProduct?: { href: string; title: string; price: string } | null;
}

export default function HeroSection({ lowestPrice, mugProduct }: Props) {
  const [text, setText] = useState('');
  const [colorIndex, setColorIndex] = useState(0);
  const [font, setFont] = useState<PrintFont>('duz');
  const [photo, setPhoto] = useState<HTMLImageElement | null>(null);

  // Seçilen fotoğraf yalnızca tarayıcıda gösterilir, hiçbir yere yüklenmez.
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.src); }, [photo]);

  // Diğer renkler tıklanınca beklemesin.
  useEffect(() => {
    const timer = setTimeout(() => {
      VITRIN_MUGS.slice(1).forEach((m) => { new window.Image().src = `/vitrin/${m.file}.webp`; });
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  const pickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const img = new window.Image();
    img.onload = () => setPhoto(img);
    img.onerror = () => URL.revokeObjectURL(img.src);
    img.src = URL.createObjectURL(file);
  };

  const mug = VITRIN_MUGS[colorIndex];
  const printed = text || (photo ? '' : SAMPLE);
  const orderText = vitrinOrderText({ text, color: mug.color, handwriting: font === 'el', hasPhoto: Boolean(photo) });
  const waHref = `${WHATSAPP_BASE}?text=${encodeURIComponent(orderText)}`;

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
          <MugPreview mug={mug} text={printed} font={font} photo={photo} />
          {mugProduct && (
            <p className="vitrin-caption">
              <Link href={mugProduct.href}>{mugProduct.title}, {mugProduct.price}</Link>
            </p>
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
            {photo ? (
              <button type="button" className="vitrin-tool" onClick={() => setPhoto(null)}>
                <CloseIcon size={16} /> Fotoğrafı kaldır
              </button>
            ) : (
              <label className="vitrin-tool vitrin-file">
                Fotoğraf deneyin
                <input type="file" accept="image/*" className="sr-only" onChange={pickPhoto} />
              </label>
            )}
          </div>
          {photo && (
            <p className="vitrin-note">Fotoğraf cihazınızda kalır. Sipariş verirken WhatsApp&apos;tan ayrıca gönderin.</p>
          )}

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

          <div className="vitrin-ctas">
            <a className="btn vitrin-order" href={waHref} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon /> {text.trim() || photo ? 'Bunu sipariş edin' : "WhatsApp'tan sipariş edin"}
            </a>
            <Link className="text-link" href="#urunler">Bütün kupalar</Link>
          </div>

          <p className="vitrin-facts">
            Tek adet de basıyoruz. Basmadan önce nasıl duracağını gönderiyoruz, onayınızdan sonra 3 iş gününde kargoda.
            {lowestPrice ? ` Kupalar ${lowestPrice.toLocaleString('tr-TR')}₺’den başlıyor.` : ''}
          </p>
        </div>
      </div>
    </section>
  );
}
