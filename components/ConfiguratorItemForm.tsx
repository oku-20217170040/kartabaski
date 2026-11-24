'use client';

import { useState, useRef, useEffect } from 'react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Product, ProductColor } from '@/types';
import { IconCamera, IconClose, IconCup, IconPalette } from '@/components/admin/icons';
import { useToast, errorMessage } from '@/components/admin/Toast';

const CLOUDINARY_CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dwulzfmlu';

function cfImg(publicId: string, w = 600) {
  return `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/image/upload/f_auto,q_auto,w_${w},c_fill/${publicId}`;
}

export const DESIGN_CATEGORIES = [
  'Kahve & Çay',
  'Doğa & Botanik',
  'Kurumsal',
  'Sevgi & Aile',
  'Seyahat & Şehir',
  'Sanat & Soyut',
  'Ayet & Hadis',
  'Özlü Sözler',
  'Diğer',
] as const;

export interface CupColor { name: string; images: string[] }

export interface ConfiguratorItemFormData {
  code: string;
  name: string;
  price?: number;
  imagePublicId?: string;
  category?: string;
  colors?: CupColor[];
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

export default function ConfiguratorItemForm({ type, initial, onSubmit, submitLabel }: Props) {
  const toast = useToast();
  const [code,          setCode]          = useState(initial?.code          || '');
  const [name,          setName]          = useState(initial?.name          || '');
  const [price,         setPrice]         = useState(String(initial?.price  || ''));
  const [imagePublicId, setImagePublicId] = useState(initial?.imagePublicId || '');
  const [category,      setCategory]      = useState(initial?.category      || '');
  const [colors,        setColors]        = useState<CupColor[]>(initial?.colors || []);
  const [active,        setActive]        = useState(initial?.active        ?? true);
  const [order,         setOrder]         = useState(String(initial?.order  ?? 1));
  const [uploading,     setUploading]     = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');

  // Ürün bağlama state'leri
  const [products,        setProducts]        = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [linkedProductId, setLinkedProductId] = useState<string>('');
  const [productColors,   setProductColors]   = useState<ProductColor[]>([]);
  // Her varyant için seçili fotoğraf index'i
  const [selectedImgIdx,  setSelectedImgIdx]  = useState<Record<number, number>>({});

  const fileRef = useRef<HTMLInputElement>(null);

  // Ürünleri yükle (cup tipinde)
  useEffect(() => {
    if (type !== 'cup') return;
    setProductsLoading(true);
    getDocs(query(collection(db, 'products'), orderBy('title')))
      .then(snap => {
        setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)).filter(p => p.active));
      })
      .finally(() => setProductsLoading(false));
  }, [type]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError('');
    try { setImagePublicId(await uploadToCloudinary(file)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Yükleme başarısız'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleProductLink = (productId: string) => {
    setLinkedProductId(productId);
    if (!productId) { setProductColors([]); setSelectedImgIdx({}); return; }
    const product = products.find(p => p.id === productId);
    const cols = product?.colors?.filter(c => c.images.length > 0) ?? [];
    setProductColors(cols);
    // Her varyant için varsayılan olarak ilk fotoğrafı seç
    const defaults: Record<number, number> = {};
    cols.forEach((_, i) => { defaults[i] = 0; });
    setSelectedImgIdx(defaults);
  };

  const applyProductColors = () => {
    const mapped: CupColor[] = productColors.map((c, i) => ({
      name: c.name,
      images: [c.images[selectedImgIdx[i] ?? 0]].filter(Boolean),
    }));
    setColors(mapped);
  };

  const handleSubmit = async () => {
    if (!code.trim() || !name.trim()) { setError('Kod ve isim zorunludur.'); return; }
    if (type === 'cup' && (!price || Number(price) <= 0)) { setError('Geçerli bir fiyat girin.'); return; }
    setSaving(true); setError('');
    try {
      await onSubmit({
        code:          code.trim().toUpperCase(),
        name:          name.trim(),
        price:         type === 'cup' ? Number(price) : undefined,
        imagePublicId: imagePublicId || undefined,
        category:      type === 'design' ? (category || undefined) : undefined,
        colors:        type === 'cup' && colors.length > 0 ? colors : undefined,
        active,
        order: Number(order) || 1,
      });
    } catch (e: unknown) {
      const msg = errorMessage(e);
      setError(msg);
      toast.error(msg);
      setSaving(false);
    }
  };

  const TypeIcon = type === 'cup' ? IconCup : IconPalette;
  const label = type === 'cup' ? 'Bardak' : 'Tasarım';

  return (
    <div className="adm-form-grid">

      {/* Sol kolon */}
      <div className="adm-form-col">

        {/* Temel bilgiler */}
        <div className="card adm-card-pad">
          <h2 className="adm-card-title">{label} Bilgileri</h2>

          <div className="adm-field-row adm-field-row-2">
            <div className="form-group">
              <label className="form-label">Kod *</label>
              <input className="form-input" value={code} onChange={e => setCode(e.target.value)}
                placeholder={type === 'cup' ? 'B1' : 'T1'} style={{ fontFamily: 'monospace', textTransform: 'uppercase' }} />
            </div>
            <div className="form-group">
              <label className="form-label">Sıra</label>
              <input className="form-input" type="number" value={order} onChange={e => setOrder(e.target.value)} placeholder="1" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">İsim *</label>
            <input className="form-input" value={name} onChange={e => setName(e.target.value)}
              placeholder={type === 'cup' ? 'Klasik Mat Kupa' : 'Çiçekli Tasarım'} />
          </div>

          {type === 'cup' && (
            <div className="form-group">
              <label className="form-label">Fiyat (₺) *</label>
              <input className="form-input" type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="250" />
            </div>
          )}

          {type === 'design' && (
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">— Kategori seç —</option>
                {DESIGN_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {/* Ana fotoğraf */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{label} Fotoğrafı</label>
            <div className="adm-photo-box">
              {imagePublicId ? (
                <div style={{ position: 'relative', width: '100%', maxWidth: 220 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cfImg(imagePublicId, 400)} alt="Yüklenen fotoğraf" style={{ width: '100%', borderRadius: 8, display: 'block', objectFit: 'cover', aspectRatio: '1/1' }} />
                  <button type="button" onClick={() => setImagePublicId('')} className="adm-thumb-remove adm-thumb-remove-lg" aria-label="Görseli kaldır"><IconClose size={14} /></button>
                </div>
              ) : (
                <div style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
                  <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}><IconCamera size={32} /></div>
                  <div>Fotoğraf yükle</div>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ minWidth: 140 }}>
                {uploading ? 'Yükleniyor...' : imagePublicId ? 'Fotoğrafı Değiştir' : 'Fotoğraf Seç'}
              </button>
            </div>
          </div>
        </div>

        {/* Renk varyantları — sadece bardak */}
        {type === 'cup' && (
          <div className="card adm-card-pad">
            <h2 className="adm-card-title">Renk Varyantları</h2>
            <p className="adm-card-sub">Mevcut bir ürüne bağlayarak varyant fotoğraflarını otomatik çek, ya da her varyant için hangi fotoğrafın gösterileceğini seç.</p>

            {/* Ürün seçici */}
            <div className="form-group">
              <label className="form-label">Ürüne Bağla</label>
              <select
                className="form-select"
                value={linkedProductId}
                onChange={e => handleProductLink(e.target.value)}
                disabled={productsLoading}
              >
                <option value="">— Ürün seç —</option>
                {products.filter(p => (p.colors?.length ?? 0) > 0).map(p => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
              <p className="adm-field-hint">Sadece renk varyantı olan ürünler listelenir.</p>
            </div>

            {/* Varyant fotoğraf seçici */}
            {productColors.length > 0 && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginBottom: 20 }}>
                  {productColors.map((c, ci) => (
                    <div key={ci}>
                      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>{c.name}</p>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {c.images.map((img, ii) => (
                          <button
                            key={ii}
                            type="button"
                            onClick={() => setSelectedImgIdx(prev => ({ ...prev, [ci]: ii }))}
                            style={{
                              padding: 0, border: 'none', borderRadius: 8, overflow: 'hidden',
                              width: 72, height: 72, minWidth: 44, cursor: 'pointer', flexShrink: 0,
                              outline: (selectedImgIdx[ci] ?? 0) === ii ? '3px solid var(--brand)' : '2px solid var(--line)',
                              outlineOffset: 2,
                              transition: 'outline-color 0.12s',
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={cfImg(img, 144)} alt={`${c.name} ${ii + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-primary btn-sm" onClick={applyProductColors}>
                  Varyantları Uygula
                </button>
              </>
            )}

            {/* Mevcut kayıtlı varyantlar */}
            {colors.length > 0 && (
              <div style={{ marginTop: productColors.length > 0 ? 24 : 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
                  Kaydedilecek Varyantlar ({colors.length})
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {colors.map((c, i) => (
                    <div key={i} style={{ textAlign: 'center' }}>
                      {c.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cfImg(c.images[0], 128)} alt={c.name} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                      ) : (
                        <div style={{ width: 56, height: 56, borderRadius: 8, background: 'var(--paper-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><IconCup size={22} /></div>
                      )}
                      <p style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>{c.name}</p>
                    </div>
                  ))}
                </div>
                <button type="button" className="adm-link-danger" onClick={() => { setColors([]); setLinkedProductId(''); setProductColors([]); setSelectedImgIdx({}); }}
                  >
                  Varyantları Temizle
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sağ kolon */}
      <div className="adm-form-col">
        <div className="card adm-card-pad">
          <h2 className="adm-card-title">Önizleme</h2>
          <div className="adm-preview">
            {imagePublicId
              ? <img src={cfImg(imagePublicId, 400)} alt="Önizleme" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> // eslint-disable-line @next/next/no-img-element
              : <span style={{ opacity: 0.3 }}><TypeIcon size={48} /></span>
            }
          </div>
          <div style={{ textAlign: 'center', fontSize: 14, fontWeight: 600 }}>{name || 'İsim girilmedi'}</div>
          {type === 'cup' && <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--accent)', fontWeight: 700, marginTop: 4 }}>{price ? `${price}₺` : '—'}</div>}
        </div>

        <div className="card adm-card-pad">
          <h2 className="adm-card-title">Durum</h2>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Görünürlük</label>
            <select className="form-select" value={String(active)} onChange={e => setActive(e.target.value === 'true')}>
              <option value="true">Aktif (Konfiguratörde görünür)</option>
              <option value="false">Pasif (Gizli)</option>
            </select>
          </div>
        </div>

        <div className="card adm-card-pad">
          {error && <div className="adm-alert" role="alert">{error}</div>}
          <button className="btn btn-primary btn-full btn-lg" onClick={handleSubmit} disabled={saving || uploading}>
            {saving ? 'Kaydediliyor...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
