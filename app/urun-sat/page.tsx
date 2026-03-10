'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { CATEGORIES } from '@/types';

const ITEM_CONDITIONS = ['Sıfır (Hiç Kullanılmamış)', '2. El – İyi Durumda', '2. El – Normal Durumda', '2. El – Hasarlı/Onarım Gerekli'];

export default function UrunSatPage() {
  const [form, setForm] = useState({
    name: '',
    phone: '',
    category: '',
    itemName: '',
    condition: '',
    price: '',
    description: '',
  });
  const [sent, setSent] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const isValid = form.name && form.phone && form.category && form.itemName && form.condition;

  const handleSubmit = () => {
    if (!isValid) return;

    const lines = [
      `🛒 *ÜRÜN SATIŞ TALEBİ*`,
      ``,
      `👤 *Ad Soyad:* ${form.name}`,
      `📞 *Telefon:* ${form.phone}`,
      ``,
      `📦 *Ürün Bilgileri*`,
      `• Kategori: ${form.category}`,
      `• Ürün: ${form.itemName}`,
      `• Kondisyon: ${form.condition}`,
      form.price ? `• Beklenen Fiyat: ₺${form.price}` : '',
      form.description ? `• Açıklama: ${form.description}` : '',
    ].filter(Boolean).join('\n');

    const url = `https://wa.me/905426447296?text=${encodeURIComponent(lines)}`;
    window.open(url, '_blank');
    setSent(true);
  };

  if (sent) {
    return (
      <>
        <Navbar />
        <main style={{ paddingTop: 'calc(var(--nav-h) + 80px)', minHeight: '100vh' }}>
          <div className="container" style={{ maxWidth: 560, textAlign: 'center', padding: '0 24px' }}>
            <div style={{ fontSize: '4rem', marginBottom: 24 }}>✅</div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', marginBottom: 16 }}>
              WhatsApp Açıldı!
            </h1>
            <p style={{ color: 'var(--muted)', lineHeight: 1.7, marginBottom: 32 }}>
              Bilgileriniz WhatsApp mesajına hazırlandı. Gönder butonuna basmanız yeterli — en kısa sürede size dönüş yapacağız.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary"
                onClick={() => { setSent(false); setForm({ name: '', phone: '', category: '', itemName: '', condition: '', price: '', description: '' }); }}
              >
                Yeni Form Doldur
              </button>
              <a href="/" className="btn btn-primary">Ana Sayfaya Dön</a>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <main style={{ paddingTop: 'calc(var(--nav-h) + 32px)', minHeight: '100vh' }}>
        <div className="container" style={{ maxWidth: 680 }}>

          {/* Hero */}
          <div className="page-hero">
            <h1 className="page-hero-title">
              Eşyanızı <span style={{ color: 'var(--accent)' }}>Satın</span>
            </h1>
            <p className="page-hero-sub">
              Formу doldurun, WhatsApp üzerinden size hemen dönelim
            </p>
          </div>

          {/* Nasıl çalışır */}
          <div className="urun-sat-steps">
            {[
              { n: '1', t: 'Formu doldurun', d: 'Ürün bilgilerini girin' },
              { n: '2', t: 'WhatsApp\'a gönderin', d: 'Tek tıkla mesaj hazır' },
              { n: '3', t: 'Fiyat teklifi alın', d: 'Size hemen dönüyoruz' },
            ].map((s) => (
              <div key={s.n} className="urun-sat-step">
                <div className="urun-sat-step-n">{s.n}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{s.t}</div>
                  <div style={{ color: 'var(--muted)', fontSize: 12 }}>{s.d}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="card" style={{ padding: 32, marginBottom: 60 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', marginBottom: 24 }}>
              Ürün Bilgileri
            </h2>

            <div className="urun-sat-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Ad Soyad *</label>
                <input
                  className="form-input"
                  placeholder="Adınız ve soyadınız"
                  value={form.name}
                  onChange={(e) => set('name', e.target.value)}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Telefon *</label>
                <input
                  className="form-input"
                  placeholder="05xx xxx xx xx"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  type="tel"
                />
              </div>
            </div>

            <div className="urun-sat-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Kategori *</label>
                <select className="form-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
                  <option value="">Kategori seçin</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Ürün Adı *</label>
                <input
                  className="form-input"
                  placeholder="Örn: 3'lü koltuk takımı"
                  value={form.itemName}
                  onChange={(e) => set('itemName', e.target.value)}
                />
              </div>
            </div>

            <div className="urun-sat-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Kondisyon *</label>
                <select className="form-select" value={form.condition} onChange={(e) => set('condition', e.target.value)}>
                  <option value="">Kondisyon seçin</option>
                  {ITEM_CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Beklediğiniz Fiyat (₺)</label>
                <input
                  className="form-input"
                  placeholder="Boş bırakabilirsiniz"
                  value={form.price}
                  onChange={(e) => set('price', e.target.value.replace(/\D/g, ''))}
                  type="text"
                  inputMode="numeric"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Ek Açıklama</label>
              <textarea
                className="form-textarea"
                placeholder="Marka, model, yaş, hasar durumu gibi detaylar ekleyebilirsiniz..."
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={4}
              />
            </div>

            <div style={{ marginTop: 8 }}>
              <button
                className="btn btn-primary btn-lg btn-full"
                onClick={handleSubmit}
                disabled={!isValid}
                style={{ opacity: isValid ? 1 : 0.5 }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp ile Gönder
              </button>
              {!isValid && (
                <p style={{ color: 'var(--muted)', fontSize: 12, textAlign: 'center', marginTop: 10 }}>
                  * işaretli alanları doldurun
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />

      <style>{`
        .urun-sat-steps {
          display: flex;
          gap: 16px;
          margin-bottom: 32px;
        }
        .urun-sat-step {
          flex: 1;
          background: var(--card);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 16px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .urun-sat-step-n {
          width: 32px; height: 32px;
          background: var(--accent-dim);
          color: var(--accent);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 15px;
          flex-shrink: 0;
        }
        .urun-sat-row {
          display: flex;
          gap: 16px;
        }
        @media (max-width: 600px) {
          .urun-sat-steps { flex-direction: column; }
          .urun-sat-row { flex-direction: column; gap: 0; }
        }
      `}</style>
    </>
  );
}
