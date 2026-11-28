'use client';

import { useEffect, useRef, useState } from 'react';
import '@fontsource-variable/shantell-sans';
import { PRINT_FONTS, drawPrint, whenFontReady } from '@/lib/mug-print';
import { MugModel, printSize } from '@/lib/mug3d';
import { cartImageSrc } from '@/lib/cart-products';
import { cloudinaryUrl, displayTitle } from '@/lib/format';
import { printFileName } from '@/lib/siparis-takip';
import { orderImageUrl } from '@/lib/siparis-types';
import type { lineSides } from '@/lib/siparis-types';
import { useToast } from '@/components/admin/Toast';
import { shapeUrl } from '@/lib/tasarim/susler';
import { fontInfo, fontSpec, loadFont } from '@/lib/tasarim/yazi-tipleri';
import type { SideContent } from './useSideContent';

interface Props {
  token: string;
  code: string;
  index: number;
  title: string;
  side: ReturnType<typeof lineSides>[number];
  data: SideContent;
  /** Baskı alanı oranı için kupa modeli. */
  model: MugModel;
}

const pct = (n: number) => `${Math.round(n * 100)}%`;
const FILE_WIDTH = 2400;

/** Bir yüzün basım bilgileri: yazı, dosyalar ve indirilebilir baskı şablonu. */
export default function PrintSide({ token, code, index, title, side, data, model }: Props) {
  const toast = useToast();
  const canvas = useRef<HTMLCanvasElement>(null);
  const [mirrored, setMirrored] = useState(false);
  const { content, loading, cutFailed, hasContent } = data;
  const size = printSize(model, FILE_WIDTH);
  const { text, font, photo, placement, layers, assets } = content;
  const written = (side.layers ?? []).flatMap((l) => (
    (l.kind === 'text' || l.kind === 'pattern') && l.text?.trim() ? [{ ...l, text: l.text }] : []
  ));
  const shapes = (side.layers ?? []).flatMap((l) => ((l.kind === 'shape' || (l.kind === 'pattern' && !l.text?.trim())) && l.set && l.name ? [{ id: l.id, set: l.set, name: l.name }] : []));

  useEffect(() => {
    let cancelled = false;
    const paint = () => {
      if (cancelled || !canvas.current) return;
      drawPrint(canvas.current, { text, font, photo, placement, layers, assets });
    };
    if (layers) paint(); else whenFontReady(font, text, paint);
    return () => { cancelled = true; };
  }, [text, font, photo, placement, layers, assets]);

  // Yazılar kendi tipleriyle gösterilsin.
  const fontIds = written.map((l) => l.font).join(',');
  useEffect(() => { fontIds.split(',').filter(Boolean).forEach((id) => { loadFont(id).catch(() => {}); }); }, [fontIds]);

  const copy = (value: string) =>
    navigator.clipboard.writeText(value)
      .then(() => toast.success('Yazı kopyalandı.'))
      .catch(() => toast.error('Kopyalanamadı. Yazıyı seçip kopyalayın.'));

  const download = () => {
    const source = canvas.current;
    if (!source) return;
    const out = document.createElement('canvas');
    out.width = source.width;
    out.height = source.height;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    // Süblimasyon transferinde baskı ters (aynalı) alınır.
    if (mirrored) { ctx.translate(out.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(source, 0, 0);
    out.toBlob((blob) => {
      if (!blob) { toast.error('Dosya hazırlanamadı.'); return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = printFileName(code, index, displayTitle(title), side.label, mirrored);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }, 'image/png');
  };

  return (
    <div className="prn-side">
      {side.label && <h3>{side.label}</h3>}

      {side.removeBg && (
        <p className="prn-flag">
          {cutFailed ? 'Müşteri arka planın silinmesini istedi; otomatik silinemedi, elle silin.' : 'Müşteri arka planın silinmesini istedi. Şablonda silinmiş hali kullanılır; kenarları kontrol edin.'}
        </p>
      )}

      {written.map((l) => (
        <div className="prn-text" key={l.id}>
          <small>{l.kind === 'pattern' ? 'Tekrarlanan yazı' : 'Basılacak yazı'} · {fontInfo(l.font).ad}</small>
          <p style={{ fontFamily: fontSpec(l.font, l.bold).family, fontWeight: fontSpec(l.font, l.bold).weight, whiteSpace: 'pre-line' }}>{l.text}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(l.text)}>Yazıyı kopyala</button>
        </div>
      ))}

      {shapes.length > 0 && (
        <div className="prn-shapes">
          <small>Süsler (şablonda yerlerinde)</small>
          <ul>
            {shapes.map((s) => (
              // eslint-disable-next-line @next/next/no-img-element
              <li key={s.id}><img src={shapeUrl(s.set, s.name)} alt={s.name.replace(/-/g, ' ')} width={36} height={36} /></li>
            ))}
          </ul>
        </div>
      )}

      {data.failed && (
        <p className="prn-flag" role="alert">
          Bir yazı tipi ya da görsel yüklenemedi; baskı dosyası eksik olur.{' '}
          <button type="button" className="btn btn-secondary btn-sm" onClick={data.retry}>Yeniden dene</button>
        </p>
      )}

      {side.text && !side.layers && (
        <div className="prn-text">
          <small>Basılacak yazı · {side.font === 'el' ? 'el yazısı' : 'düz yazı'}</small>
          <p style={{ fontFamily: PRINT_FONTS[font].family, fontWeight: PRINT_FONTS[font].weight }}>{side.text}</p>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => copy(side.text!)}>Yazıyı kopyala</button>
        </div>
      )}

      {hasContent && (
        <div className="prn-template">
          <small>Baskı şablonu (müşterinin yerleşimiyle) · {size.width}×{size.height} px</small>
          <div className="prn-canvas">
            <canvas ref={canvas} width={size.width} height={size.height} style={mirrored ? { transform: 'scaleX(-1)' } : undefined} aria-label={`${side.label || 'Baskı'} şablonu`} role="img" />
            {loading && <span role="status">{side.removeBg ? 'Arka plan siliniyor…' : 'Görsel yükleniyor…'}</span>}
          </div>
          <label className="prn-check">
            <input type="checkbox" checked={mirrored} onChange={(e) => setMirrored(e.target.checked)} />
            Aynalı indir (transfer baskı)
          </label>
          <button type="button" className="btn btn-primary btn-sm prn-download" onClick={download} disabled={loading || data.failed}>Baskı dosyasını indir</button>
        </div>
      )}

      {side.ready && (
        <div className="prn-files">
          <small>Hazır tasarım: <b>{side.ready.name}</b></small>
          {side.ready.image && (
            <ul>
              <li>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={cartImageSrc(side.ready.image) ?? ''} alt={side.ready.name} loading="lazy" />
                <a className="btn btn-secondary btn-sm" href={cloudinaryUrl(side.ready.image, 'fl_attachment')}>İndir</a>
              </li>
            </ul>
          )}
        </div>
      )}

      {side.files.length > 0 && (
        <div className="prn-files">
          <small>Müşterinin fotoğrafları ({side.files.length}){side.files.length > 1 && !side.layers ? ' · şablonda ilki kullanılır' : ''}</small>
          <ul>
            {side.files.map((id, i) => (
              <li key={id}>
                <a href={orderImageUrl(token, id, 900)} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={orderImageUrl(token, id, 240)} alt={`${side.label} fotoğraf ${i + 1}, büyütmek için dokunun`.trim()} loading="lazy" />
                </a>
                <a className="btn btn-secondary btn-sm" href={orderImageUrl(token, id)}>Orijinali indir</a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {side.placement && (
        <details className="prn-more">
          <summary>Yerleşim değerleri</summary>
          <p>Boyut {pct(side.placement.scale)} · yatay {pct(side.placement.x)} · dikey {pct(side.placement.y)} · açı {Math.round(side.placement.rotate)}°</p>
        </details>
      )}
    </div>
  );
}
