'use client';

import { useState, useRef, useEffect } from 'react';
import { Product, CATEGORIES, Category } from '@/types';
import { cloudinaryUrl } from '@/lib/products';

interface Props {
  initial?: Partial<Product>;
  onSubmit: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  submitLabel: string;
}

async function uploadToCloudinary(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || 'Upload failed');
  }
  const data = await res.json();
  return data.public_id as string;
}

export default function ProductForm({ initial, onSubmit, submitLabel }: Props) {
  const [title, setTitle] = useState(initial?.title || '');
  const [slug, setSlug] = useState(initial?.slug || '');
  const [price, setPrice] = useState(String(initial?.priceTRY || ''));
  const [category, setCategory] = useState<Category>(initial?.category || 'Mobilya');
  const [condition, setCondition] = useState<'Sıfır' | '2. El'>(initial?.condition || '2. El');
  const [inStock, setInStock] = useState(initial?.inStock ?? true);
  const [description, setDescription] = useState(initial?.description || '');
  const [images, setImages] = useState<string[]>(initial?.images || []);
  const [tags, setTags] = useState<string[]>(initial?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [seoTags, setSeoTags] = useState<string[]>(initial?.seoTags || []);
  const [seoTagInput, setSeoTagInput] = useState('');
  const [specsRaw, setSpecsRaw] = useState(
    Object.entries(initial?.specs || {}).map(([k, v]) => `${k}:${v}`).join('\n')
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Bu session'da yüklenen (henüz kaydedilmemiş) görselleri takip et
  const sessionUploads = useRef<Set<string>>(new Set());
  const savedRef = useRef(false);

  // Sayfa terk edilince kaydedilmemiş görselleri Cloudinary'den sil
  useEffect(() => {
    return () => {
      if (!savedRef.current && sessionUploads.current.size > 0) {
        navigator.sendBeacon(
          '/api/cloudinary-delete',
          new Blob(
            [JSON.stringify({ publicIds: Array.from(sessionUploads.current) })],
            { type: 'application/json' }
          )
        );
      }
    };
  }, []);

  // Auto-slug
  const handleTitleChange = (v: string) => {
    setTitle(v);
    if (!initial?.slug) {
      const s = v
        .toLowerCase()
        .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
        .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim().replace(/\s+/g, '-');
      setSlug(s);
    }
  };

  const handleUpload = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      const ids = await Promise.all(Array.from(files).map(uploadToCloudinary));
      ids.forEach((id) => sessionUploads.current.add(id));
      setImages((prev) => [...prev, ...ids]);
    } catch {
      setError('Görsel yüklenemedi. Cloudinary ayarlarını kontrol edin.');
    } finally {
      setUploading(false);
    }
  };

  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput('');
  };

  const removeTag = (t: string) => setTags((prev) => prev.filter((x) => x !== t));

  const addSeoTag = () => {
    const t = seoTagInput.trim();
    if (t && !seoTags.includes(t)) setSeoTags((prev) => [...prev, t]);
    setSeoTagInput('');
  };

  const removeSeoTag = (t: string) => setSeoTags((prev) => prev.filter((x) => x !== t));

  const parseSpecs = (): Record<string, string> => {
    const specs: Record<string, string> = {};
    specsRaw.split('\n').forEach((line) => {
      const [k, ...rest] = line.split(':');
      if (k && rest.length) specs[k.trim()] = rest.join(':').trim();
    });
    return specs;
  };

  const handleSubmit = async () => {
    if (!title || !slug || !price) {
      setError('Başlık, slug ve fiyat zorunludur.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        title,
        slug,
        priceTRY: Number(price),
        category,
        condition,
        inStock,
        shortDesc: initial?.shortDesc || '',
        description,
        images,
        tags,
        seoTags,
        specs: parseSpecs(),
      });
      savedRef.current = true;
      sessionUploads.current.clear();
    } catch (e: any) {
      setError(e.message || 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 28, alignItems: 'start' }}>
      {/* Left column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        <div className="card" style={{ padding: 28, marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 20 }}>Temel Bilgiler</h2>

          <div className="form-group">
            <label className="form-label">Başlık *</label>
            <input className="form-input" value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="L Köşe Koltuk Gri" />
          </div>

          <div className="form-group">
            <label className="form-label">Slug *</label>
            <input className="form-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="l-kose-koltuk-gri" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Fiyat (TL) *</label>
              <input className="form-input" type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="14900" />
            </div>
            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Detaylı Açıklama</label>
            <textarea className="form-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ürün hakkında detaylı bilgi..." style={{ minHeight: 120 }} />
          </div>
        </div>

        {/* Specs */}
        <div className="card" style={{ padding: 28, marginBottom: 20 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Özellikler</h2>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>Her satıra bir özellik: <code style={{ background: 'var(--bg)', padding: '2px 6px', borderRadius: 4 }}>Anahtar:Değer</code></p>
          <textarea
            className="form-textarea"
            value={specsRaw}
            onChange={(e) => setSpecsRaw(e.target.value)}
            placeholder={"Renk:Gri\nDurum:2.El\nTeslimat:Aynı Gün"}
            style={{ minHeight: 130, fontFamily: 'monospace', fontSize: 13 }}
          />
        </div>

        {/* Images */}
        <div className="card" style={{ padding: 28 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 16 }}>Görseller</h2>

          <div
            className={`img-upload-zone ${dragOver ? 'drag-over' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
          >
            {uploading ? '⏳ Yükleniyor...' : '📷 Fotoğraf yüklemek için tıklayın veya sürükleyin'}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleUpload(e.target.files)}
          />

          {images.length > 0 && (
            <div className="img-preview-grid">
              {images.map((id, i) => (
                <div key={id} className="img-preview-item">
                  <img src={cloudinaryUrl(id, 'f_auto,q_auto,w_200,h_160,c_fill')} alt={`img-${i}`} />
                  <button
                    className="img-preview-remove"
                    onClick={() => {
                      // Session'da yüklendiyse Cloudinary'den hemen sil
                      if (sessionUploads.current.has(id)) {
                        sessionUploads.current.delete(id);
                        fetch('/api/cloudinary-delete', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ publicIds: [id] }),
                        });
                      }
                      setImages((prev) => prev.filter((_, j) => j !== i));
                    }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right column */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Status */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 16 }}>Durum</h2>

          <div className="form-group">
            <label className="form-label">Kondisyon</label>
            <select className="form-select" value={condition} onChange={(e) => setCondition(e.target.value as 'Sıfır' | '2. El')}>
              <option>Sıfır</option>
              <option>2. El</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Stok Durumu</label>
            <select className="form-select" value={String(inStock)} onChange={(e) => setInStock(e.target.value === 'true')}>
              <option value="true">Stokta</option>
              <option value="false">Satıldı</option>
            </select>
          </div>
        </div>

        {/* Tags */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 12 }}>Etiketler</h2>
          <div className="tags-wrap">
            {tags.map((t) => (
              <span key={t} className="tag-chip">
                {t}
                <button onClick={() => removeTag(t)}>×</button>
              </span>
            ))}
            <input
              className="tags-input"
              placeholder="Etiket ekle..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); } }}
            />
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Enter veya virgül ile ekle. Örn: Nakliye Var, Aynı Gün Teslim</p>
        </div>

        {/* SEO Tags */}
        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 4 }}>SEO Etiketleri 🔍</h2>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Müşterilere gösterilmez — sadece arama motorları için JSON-LD'ye gömülür.</p>
          <div className="tags-wrap">
            {seoTags.map((t) => (
              <span key={t} className="tag-chip" style={{ opacity: 0.75 }}>
                {t}
                <button onClick={() => removeSeoTag(t)}>×</button>
              </span>
            ))}
            <input
              className="tags-input"
              placeholder="SEO etiketi ekle..."
              value={seoTagInput}
              onChange={(e) => setSeoTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSeoTag(); } }}
            />
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Örn: ikinci el koltuk esenyurt, spot mobilya istanbul</p>
        </div>

        {/* Submit */}
        <div className="card" style={{ padding: 24 }}>
          {error && (
            <div style={{ background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.25)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--danger)', marginBottom: 16 }}>
              {error}
            </div>
          )}
          <button
            className="btn btn-primary btn-full btn-lg"
            onClick={handleSubmit}
            disabled={saving || uploading}
          >
            {saving ? 'Kaydediliyor...' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
