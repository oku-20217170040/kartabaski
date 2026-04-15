'use client';

import { useState, useRef } from 'react';

const CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dwulzfmlu';

function cfImg(publicId: string, w = 600) {
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/f_auto,q_auto,w_${w},c_fill/${publicId}`;
}

// Gradient ön ayarları — image yoksa fallback olarak kullanılır
const GRADIENT_PRESETS = [
  { label: 'Mor–Eflatun',    value: 'linear-gradient(135deg,#6366F1,#8B5CF6)',   text: 'rgba(255,255,255,0.92)' },
  { label: 'Pembe–Kırmızı',  value: 'linear-gradient(135deg,#EC4899,#F43F5E)',   text: 'rgba(255,255,255,0.92)' },
  { label: 'Teal–Mavi',      value: 'linear-gradient(135deg,#14B8A6,#0EA5E9)',   text: 'rgba(255,255,255,0.92)' },
  { label: 'Turuncu–Sarı',   value: 'linear-gradient(135deg,#F97316,#EAB308)',   text: 'rgba(255,255,255,0.92)' },
  { label: 'Yeşil–Zümrüt',   value: 'linear-gradient(135deg,#10B981,#059669)',   text: 'rgba(255,255,255,0.92)' },
  { label: 'Mavi–Mor',       value: 'linear-gradient(135deg,#3B82F6,#6366F1)',   text: 'rgba(255,255,255,0.92)' },
  { label: 'Turuncu–Kırmızı',value: 'linear-gradient(135deg,#F59E0B,#EF4444)',   text: 'rgba(255,255,255,0.92)' },
  { label: 'Pembe–Mor',      value: 'linear-gradient(135deg,#8B5CF6,#EC4899)',   text: 'rgba(255,255,255,0.92)' },
  { label: 'Cyan–Yeşil',     value: 'linear-gradient(135deg,#06B6D4,#10B981)',   text: 'rgba(255,255,255,0.92)' },
  { label: 'Antrasit',       value: 'linear-gradient(135deg,#64748B,#334155)',   text: 'rgba(255,255,255,0.92)' },
  { label: 'Buz Mavisi',     value: 'linear-gradient(135deg,#EFF6FF,#BFDBFE)',   text: '#1E40AF' },
  { label: 'Sade Gri',       value: 'linear-gradient(135deg,#F3F4F6,#D1D5DB)',   text: '#374151' },
  { label: 'Pastel Pembe',   value: 'linear-gradient(135deg,#FDF2F8,#FBCFE8)',   text: '#9D174D' },
  { label: 'Pastel Sarı',    value: 'linear-gradient(135deg,#FFFBEB,#FDE68A)',   text: '#92400E' },
  { label: 'Pastel Yeşil',   value: 'linear-gradient(135deg,#F0FDF4,#BBF7D0)',   text: '#14532D' },
  { label: 'Pastel Mor',     value: 'linear-gradient(135deg,#FAF5FF,#DDD6FE)',   text: '#4C1D95' },
];

export interface ConfiguratorItemFormData {
  code: string;
  name: string;
  price?: number;          // sadece bardak için
  imagePublicId?: string;  // Cloudinary public_id
  gradient: string;
  textColor: string;
  active: boolean;
  order: number;
}

interface Props {
  type: 'cup' | 'design';
  initial?: Partial<ConfiguratorItemFormData>;
  onSubmit: (data: ConfiguratorItemFormData) => Promise<void>;
  submitLabel: string;
  backHref: string;
}

async function uploadToCloudinary(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await fetch('/api/upload', { method: 'POST', body: form });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'Yükleme başarısız');
  }
  const data = await res.json();
  return data.public_id as string;
}

export default function ConfiguratorItemForm({ type, initial, onSubmit, submitLabel, backHref }: Props) {
  const [code,          setCode]          = useState(initial?.code          || '');
  const [name,          setName]          = useState(initial?.name          || '');
  const [price,         setPrice]         = useState(String(initial?.price  || ''));
  const [imagePublicId, setImagePublicId] = useState(initial?.imagePublicId || '');
  const [gradient,      setGradient]      = useState(initial?.gradient      || GRADIENT_PRESETS[0].value);
  const [textColor,     setTextColor]     = useState(initial?.textColor     || GRADIENT_PRESETS[0].text);
  const [active,        setActive]        = useState(initial?.active        ?? true);
  const [order,         setOrder]         = useState(String(initial?.order  ?? 1));
  const [uploading,     setUploading]     = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  const handlePreset = (preset: typeof GRADIENT_PRESETS[0]) => {
    setGradient(preset.value);
    setTextColor(preset.text);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const pid = await uploadToCloudinary(file);
      setImagePublicId(pid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Yükleme başarısız');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!code.trim() || !name.trim()) { setError('Kod ve isim zorunludur.'); return; }
    if (type === 'cup' && (!price || Number(price) <= 0)) { setError('Geçerli bir fiyat girin.'); return; }
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        code:          code.trim().toUpperCase(),
        name:          name.trim(),
        price:         type === 'cup' ? Number(price) : undefined,
        imagePublicId: imagePublicId || undefined,
        gradient,
        textColor,
        active,
        order: Number(order) || 1,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bir hata oluştu.');
      setSaving(false);
    }
  };

  const emoji = type === 'cup' ? '☕' : '🎨';
  const label = type === 'cup' ? 'Bardak' : 'Tasarım';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>

      {/* Sol kolon */}
      <div className="card" style={{ padding: 28 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 20 }}>
          {label} Bilgileri
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className="form-group">
            <label className="form-label">Kod *</label>
            <input
              className="form-input"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder={type === 'cup' ? 'B1' : 'T1'}
              style={{ fontFamily: 'monospace', textTransform: 'uppercase' }}
            />
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>
              {type === 'cup' ? 'Ör: B1, B2, B3' : 'Ör: T1, T2, T3'}
            </p>
          </div>
          <div className="form-group">
            <label className="form-label">Sıra</label>
            <input
              className="form-input"
              type="number"
              value={order}
              onChange={e => setOrder(e.target.value)}
              placeholder="1"
            />
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>Listede gösterim sırası</p>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">İsim *</label>
          <input
            className="form-input"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={type === 'cup' ? 'Klasik Mat Kupa' : 'Çiçekli Tasarım'}
          />
        </div>

        {type === 'cup' && (
          <div className="form-group">
            <label className="form-label">Fiyat (₺) *</label>
            <input
              className="form-input"
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="250"
            />
          </div>
        )}

        {/* Fotoğraf yükleme */}
        <div className="form-group">
          <label className="form-label">{label} Fotoğrafı</label>
          <div style={{
            border: '2px dashed var(--border)',
            borderRadius: 10,
            padding: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
            background: 'var(--surface-raised)',
          }}>
            {imagePublicId ? (
              <div style={{ position: 'relative', width: '100%', maxWidth: 220 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cfImg(imagePublicId, 400)}
                  alt="Yüklenen fotoğraf"
                  style={{ width: '100%', borderRadius: 8, display: 'block', objectFit: 'cover', aspectRatio: '1/1' }}
                />
                <button
                  type="button"
                  onClick={() => setImagePublicId('')}
                  style={{
                    position: 'absolute', top: 6, right: 6,
                    background: 'rgba(0,0,0,0.6)', color: '#fff',
                    border: 'none', borderRadius: '50%',
                    width: 26, height: 26, cursor: 'pointer',
                    fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  title="Fotoğrafı kaldır"
                >✕</button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                <div style={{ fontSize: 32, marginBottom: 6 }}>📷</div>
                <div>Fotoğraf yükle</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>JPG, PNG — önerilen kare format</div>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              style={{ minWidth: 140 }}
            >
              {uploading ? 'Yükleniyor...' : imagePublicId ? 'Fotoğrafı Değiştir' : 'Fotoğraf Seç'}
            </button>
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
            Fotoğraf yüklenmezse aşağıdaki renk/gradient kullanılır.
          </p>
        </div>

        {/* Gradient seçimi — fallback */}
        <div className="form-group">
          <label className="form-label">Renk / Gradient (fotoğraf yoksa gösterilir)</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 12 }}>
            {GRADIENT_PRESETS.map(preset => (
              <button
                key={preset.value}
                type="button"
                onClick={() => handlePreset(preset)}
                title={preset.label}
                style={{
                  height: 36,
                  borderRadius: 6,
                  background: preset.value,
                  border: gradient === preset.value ? '3px solid var(--accent)' : '2px solid transparent',
                  cursor: 'pointer',
                  transition: 'border 0.15s',
                  boxShadow: gradient === preset.value ? '0 0 0 2px rgba(201,168,76,0.3)' : undefined,
                }}
              />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Özel Gradient CSS</label>
              <input
                className="form-input"
                value={gradient}
                onChange={e => setGradient(e.target.value)}
                placeholder="linear-gradient(135deg,#6366F1,#8B5CF6)"
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: 11 }}>Metin Rengi</label>
              <input
                className="form-input"
                value={textColor}
                onChange={e => setTextColor(e.target.value)}
                placeholder="rgba(255,255,255,0.92)"
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Sağ kolon */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Önizleme */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 16 }}>Önizleme</h2>
          <div style={{
            width: '100%', aspectRatio: '1/1',
            borderRadius: 12,
            overflow: 'hidden',
            background: imagePublicId ? '#f3f4f6' : gradient,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 10,
            boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
            position: 'relative',
          }}>
            {imagePublicId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cfImg(imagePublicId, 400)}
                alt="Önizleme"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <>
                <span style={{ fontWeight: 800, fontSize: '2rem', color: textColor }}>
                  {code || (type === 'cup' ? 'B?' : 'T?')}
                </span>
                <span style={{ fontSize: '1rem', opacity: 0.8, marginTop: 4, color: textColor }}>{emoji}</span>
              </>
            )}
          </div>
          <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{name || 'İsim girilmedi'}</div>
          {type === 'cup' && (
            <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--accent)', fontWeight: 700, marginTop: 4 }}>
              {price ? `${price}₺` : '—'}
            </div>
          )}
        </div>

        {/* Durum */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 16 }}>Durum</h2>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Görünürlük</label>
            <select className="form-select" value={String(active)} onChange={e => setActive(e.target.value === 'true')}>
              <option value="true">Aktif (Konfiguratörde görünür)</option>
              <option value="false">Pasif (Gizli)</option>
            </select>
          </div>
        </div>

        {/* Kaydet */}
        <div className="card" style={{ padding: 24 }}>
          {error && (
            <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>
              {error}
            </div>
          )}
          <button className="btn btn-primary btn-full btn-lg" onClick={handleSubmit} disabled={saving || uploading}>
            {saving ? 'Kaydediliyor...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
