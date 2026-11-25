'use client';

import { useMemo, useState } from 'react';
import { CATEGORIES, type Category } from '@/types';
import { categoryUrl } from '@/lib/social-content-utils';
import { SITE_NAME } from '@/lib/constants';
import { IconWhatsApp } from './icons';
import './social/social.css';

// Müşteri numarasını wa.me biçimine çevirir (notify.ts server-only olduğu için burada tekrar yazıldı)
export function toWaNumber(phone: string): string {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = '90' + d.slice(1);
  else if (d.length === 10) d = '90' + d;
  return d;
}

/** Müşteriye gidecek, seçilen kategorinin sayfasına bağlanan WhatsApp mesajı. */
export function categoryMessage(category: string): string {
  return [
    `Merhaba, ${SITE_NAME}'ta *${category}* modellerimizin hepsine bu linkten bakabilirsiniz:`,
    '',
    categoryUrl(category),
    '',
    'İsim, fotoğraf ya da logonuzla baskı için bize yazabilirsiniz.',
  ].join('\n');
}

/** Seçilen kategorideki aktif modelleri, müşteriye gönderilecek tek bir WhatsApp mesajına çevirir. */
export default function CategoryShareBox({ products }: { products: { category: string; active: boolean }[] }) {
  const [cat, setCat] = useState<Category | ''>('');
  const [phone, setPhone] = useState('');

  const count = useMemo(() => (cat ? products.filter((p) => p.category === cat && p.active).length : 0), [products, cat]);

  const send = () => {
    if (!cat || count === 0) return;
    const base = phone.trim() ? `https://wa.me/${toWaNumber(phone)}` : 'https://wa.me/';
    // Kişi seçilmezse WhatsApp mesajı yine hazır getirir
    window.open(`${base}?text=${encodeURIComponent(categoryMessage(cat))}`, '_blank', 'noopener');
  };

  return (
    <div className="soc-panel">
      <h2>Kategoriyi müşteriye gönder</h2>
      <p className="soc-muted">Müşteriye o kategorinin sayfa bağlantısını hazırlar; bağlantı açılınca kategorideki tüm modeller görünür.</p>
      <div className="soc-form-row">
        <div className="soc-field">
          <label htmlFor="cs-cat">Kategori</label>
          <select id="cs-cat" value={cat} onChange={(e) => setCat(e.target.value as Category | '')}>
            <option value="">Kategori seçin</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="soc-field">
          <label htmlFor="cs-phone">Müşteri telefonu (isteğe bağlı)</label>
          <input id="cs-phone" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="off" />
        </div>
        <button type="button" className="btn btn-primary" onClick={send} disabled={!cat || count === 0}>
          <IconWhatsApp size={16} /> WhatsApp&apos;ta hazırla
        </button>
      </div>
      {cat && <p className="soc-muted" style={{ marginTop: 8 }}>{count > 0 ? `${count} aktif model bu kategoride.` : 'Bu kategoride aktif model yok.'}</p>}
    </div>
  );
}
