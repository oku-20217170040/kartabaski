'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
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
    throw new Error((err as { error?: string }).error || 'Upload failed');
  }
  const data = await res.json();
  return data.public_id as string;
}

export default function ProductForm({ initial, onSubmit, submitLabel }: Props) {
  const [title, setTitle] = useState(initial?.title || '');
  const [slug, setSlug] = useState(initial?.slug || '');
  const [priceMin, setPriceMin] = useState(String(initial?.priceMin || ''));
  const [priceMax, setPriceMax] = useState(String(initial?.priceMax || ''));
  const [category, setCategory] = useState<Category>(initial?.category || 'Sihirli Kupa');
  const [active, setActive] = useState(initial?.active ?? true);
  const [deliveryDays, setDeliveryDays] = useState(String(initial?.deliveryDays || '3'));
  const [description, setDescription] = useState(initial?.description || '');
  const [images, setImages] = useState<string[]>(initial?.images || []);
  const [productCode, setProductCode] = useState(initial?.productCode || '');
  const [seoTags, setSeoTags] = useState<string[]>(initial?.seoTags || []);
  const [seoTagInput, setSeoTagInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  // Image reorder — desktop (HTML5 drag) + mobile (touch)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  // Touch drag
  const [touchDragIndex, setTouchDragIndex] = useState<number | null>(null);
  const [touchGhostPos, setTouchGhostPos] = useState<{ x: number; y: number } | null>(null);
  const touchDragIndexRef = useRef<number | null>(null);
  const imgGridRef = useRef<HTMLDivElement>(null);

  // Camera
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [mounted, setMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const fileRef = useRef<HTMLInputElement>(null);

  const sessionUploads = useRef<Set<string>>(new Set());
  const savedRef = useRef(false);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
    setShowCamera(false);
    setCameraError('');
    const top = document.body.style.top;
    document.body.style.position = '';
    document.body.style.top = '';
    document.body.style.width = '';
    document.body.style.overflow = '';
    if (top) window.scrollTo(0, -parseInt(top, 10));
  }, []);

  useEffect(() => {
    return () => {
      stopCamera();
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
  }, [stopCamera]);

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

  // ── Camera ────────────────────────────────────────────────────────────────────

  const startCamera = async () => {
    setCameraError('');
    setCameraReady(false);
    setShowCamera(true);
    document.body.style.top = `-${window.scrollY}px`;
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError('Kameraya erişilemedi. Tarayıcı izinlerini kontrol edin.');
      setShowCamera(false);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], `kamera-${Date.now()}.jpg`, { type: 'image/jpeg' });
      stopCamera();
      setUploading(true);
      try {
        const id = await uploadToCloudinary(file);
        sessionUploads.current.add(id);
        setImages((prev) => [...prev, id]);
      } catch {
        setError('Fotoğraf yüklenemedi.');
      } finally {
        setUploading(false);
      }
    }, 'image/jpeg', 0.92);
  };

  // ── Image reorder (drag & drop) ───────────────────────────────────────────────

  const handleImgDragStart = (index: number) => { dragIndexRef.current = index; };

  const handleImgDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndexRef.current !== null) setDragOverIndex(index);
  };

  const handleImgDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from === null || from === dropIndex) { setDragOverIndex(null); return; }
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(dropIndex, 0, moved);
      return next;
    });
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  const handleImgDragEnd = () => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  };

  // ── Image reorder — touch (mobile) ───────────────────────────────────────────

  useEffect(() => {
    const grid = imgGridRef.current;
    if (!grid) return;

    const onTouchMove = (e: TouchEvent) => {
      if (touchDragIndexRef.current === null) return;
      e.preventDefault();
      const touch = e.touches[0];
      setTouchGhostPos({ x: touch.clientX, y: touch.clientY });
      const el = document.elementFromPoint(touch.clientX, touch.clientY);
      const item = el?.closest('[data-img-index]') as HTMLElement | null;
      if (item) {
        const idx = parseInt(item.dataset.imgIndex ?? '-1', 10);
        if (idx >= 0) setDragOverIndex(idx);
      }
    };

    grid.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => grid.removeEventListener('touchmove', onTouchMove);
  }, []);

  const handleImgTouchStart = (e: React.TouchEvent, index: number) => {
    touchDragIndexRef.current = index;
    setTouchDragIndex(index);
    const touch = e.touches[0];
    setTouchGhostPos({ x: touch.clientX, y: touch.clientY });
    setDragOverIndex(index);
  };

  const handleImgTouchEnd = () => {
    const from = touchDragIndexRef.current;
    const to = dragOverIndex;
    if (from !== null && to !== null && from !== to) {
      setImages((prev) => {
        const next = [...prev];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    }
    touchDragIndexRef.current = null;
    setTouchDragIndex(null);
    setTouchGhostPos(null);
    setDragOverIndex(null);
  };

  // ─────────────────────────────────────────────────────────────────────────────

  const addSeoTag = () => {
    const t = seoTagInput.trim();
    if (t && !seoTags.includes(t)) setSeoTags((prev) => [...prev, t]);
    setSeoTagInput('');
  };

  const removeSeoTag = (t: string) => setSeoTags((prev) => prev.filter((x) => x !== t));

  const handleSubmit = async () => {
    if (!title || !slug) {
      setError('Başlık ve slug zorunludur.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit({
        title,
        slug,
        priceMin: Number(priceMin) || 0,
        priceMax: Number(priceMax) || 0,
        category,
        active,
        shortDesc: initial?.shortDesc || '',
        description,
        images,
        deliveryDays: Number(deliveryDays) || 3,
        seoTags,
        productCode: productCode.trim() || undefined,
      });
      savedRef.current = true;
      sessionUploads.current.clear();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bir hata oluştu.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* ── Camera Modal ── */}
      {showCamera && mounted && createPortal(
        <div
          style={{
            position: 'fixed',
            top: 0, left: 0,
            width: '100vw', height: '100vh',
            zIndex: 99999,
            background: '#000',
            overflow: 'hidden',
            touchAction: 'none',
            transform: 'translateZ(0)',
          }}
        >
          {cameraError ? (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 20,
            }}>
              <p style={{ color: '#f85149', fontSize: 15, textAlign: 'center', padding: '0 32px' }}>
                {cameraError}
              </p>
              <button onClick={stopCamera} style={{
                padding: '10px 28px', borderRadius: 8,
                background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff', fontSize: 14, cursor: 'pointer',
              }}>Kapat</button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onCanPlay={() => setCameraReady(true)}
                style={{
                  position: 'absolute',
                  top: 0, left: 0,
                  width: '100%', height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />

              <button
                onClick={stopCamera}
                style={{
                  position: 'absolute', top: 20, right: 20, zIndex: 10,
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.25)',
                  borderRadius: '50%',
                  width: 44, height: 44,
                  color: '#fff', fontSize: 18,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                aria-label="Kamerayı kapat"
              >✕</button>

              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                paddingTop: 24,
                paddingBottom: 'max(40px, env(safe-area-inset-bottom, 40px))',
                background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)',
              }}>
                {!cameraReady ? (
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Kamera başlatılıyor...</span>
                ) : (
                  <button
                    onClick={capturePhoto}
                    style={{
                      width: 76, height: 76,
                      borderRadius: '50%',
                      background: '#fff',
                      border: '4px solid rgba(255,255,255,0.5)',
                      boxShadow: '0 0 0 4px rgba(255,255,255,0.2)',
                      cursor: 'pointer',
                      transition: 'transform 0.1s',
                    }}
                    onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.91)'; }}
                    onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    onTouchStart={(e) => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.91)'; }}
                    onTouchEnd={(e) => { e.stopPropagation(); (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
                    aria-label="Fotoğraf çek"
                  />
                )}
              </div>
            </>
          )}
        </div>
      , document.body)}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 28, alignItems: 'start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div className="card" style={{ padding: 28, marginBottom: 20 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 20 }}>Temel Bilgiler</h2>

            <div className="form-group">
              <label className="form-label">Başlık *</label>
              <input className="form-input" value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="Sihirli Kupa - 330ml" />
            </div>

            <div className="form-group">
              <label className="form-label">Slug *</label>
              <input className="form-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="sihirli-mat-kupa-330ml" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Min Fiyat (TL)</label>
                <input className="form-input" type="number" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} placeholder="150" />
              </div>
              <div className="form-group">
                <label className="form-label">Max Fiyat (TL)</label>
                <input className="form-input" type="number" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} placeholder="350" />
              </div>
              <div className="form-group">
                <label className="form-label">Teslimat (iş günü)</label>
                <input className="form-input" type="number" value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value)} placeholder="3" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Kategori</label>
              <select className="form-select" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Detaylı Açıklama</label>
              <textarea className="form-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ürün hakkında detaylı bilgi..." style={{ minHeight: 120 }} />
            </div>
          </div>

          {/* Images */}
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 16 }}>Görseller</h2>

            <div style={{ display: 'flex', gap: 10, marginBottom: images.length > 0 ? 0 : undefined }}>
              <div
                className={`img-upload-zone ${dragOver ? 'drag-over' : ''}`}
                style={{ flex: 1, marginBottom: 0 }}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleUpload(e.dataTransfer.files); }}
              >
                {uploading ? '⏳ Yükleniyor...' : '📁 Dosya seç veya sürükle'}
              </div>

              <button
                type="button"
                onClick={startCamera}
                disabled={uploading}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 4, padding: '12px 18px',
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'transparent',
                  color: 'var(--muted)',
                  fontSize: 12, cursor: 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}
                onMouseOver={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent)';
                }}
                onMouseOut={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
                  (e.currentTarget as HTMLButtonElement).style.color = 'var(--muted)';
                }}
              >
                <span style={{ fontSize: 22 }}>📷</span>
                Kamera
              </button>
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
              <>
                {images.length > 1 && (
                  <p style={{ fontSize: 11, color: 'var(--muted)', margin: '10px 0 6px', userSelect: 'none' }}>
                    Sıralamak için görselleri sürükleyin — ilk görsel ürün kapak fotoğrafı olur
                  </p>
                )}
                {touchGhostPos && touchDragIndex !== null && (
                  <div style={{
                    position: 'fixed',
                    left: touchGhostPos.x - 45,
                    top: touchGhostPos.y - 38,
                    width: 90, height: 75,
                    borderRadius: 8, overflow: 'hidden',
                    border: '2px solid var(--accent)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    opacity: 0.9, pointerEvents: 'none', zIndex: 999,
                    transform: 'scale(1.08)',
                  }}>
                    <img
                      src={cloudinaryUrl(images[touchDragIndex], 'f_auto,q_auto,w_200,h_160,c_fill')}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      alt=""
                    />
                  </div>
                )}

                <div className="img-preview-grid" ref={imgGridRef}>
                  {images.map((id, i) => (
                    <div
                      key={id}
                      className="img-preview-item"
                      data-img-index={i}
                      draggable
                      onDragStart={() => handleImgDragStart(i)}
                      onDragOver={(e) => handleImgDragOver(e, i)}
                      onDrop={(e) => handleImgDrop(e, i)}
                      onDragEnd={handleImgDragEnd}
                      onTouchStart={(e) => handleImgTouchStart(e, i)}
                      onTouchEnd={handleImgTouchEnd}
                      style={{
                        cursor: 'grab',
                        outline: dragOverIndex === i && (dragIndexRef.current !== i && touchDragIndex !== i)
                          ? '2px solid var(--accent)'
                          : undefined,
                        opacity: dragIndexRef.current === i || touchDragIndex === i ? 0.35 : 1,
                        transition: 'outline 0.1s, opacity 0.1s',
                      }}
                    >
                      <img src={cloudinaryUrl(id, 'f_auto,q_auto,w_200,h_160,c_fill')} alt={`img-${i}`} draggable={false} />

                      <span style={{
                        position: 'absolute', bottom: 4, left: 4,
                        background: i === 0 ? 'var(--accent)' : 'rgba(0,0,0,0.65)',
                        color: i === 0 ? '#0a0a0a' : '#fff',
                        fontSize: 10, fontWeight: 700,
                        padding: '1px 5px', borderRadius: 4,
                        lineHeight: '16px', userSelect: 'none', pointerEvents: 'none',
                      }}>
                        {i === 0 ? 'Kapak' : `#${i + 1}`}
                      </span>

                      <button
                        className="img-preview-remove"
                        onClick={() => {
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
              </>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Status */}
          <div className="card" style={{ padding: 24 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 16 }}>Durum</h2>

            <div className="form-group">
              <label className="form-label">Ürün Durumu</label>
              <select className="form-select" value={String(active)} onChange={(e) => setActive(e.target.value === 'true')}>
                <option value="true">Aktif (Sitede görünür)</option>
                <option value="false">Pasif (Gizli)</option>
              </select>
            </div>
          </div>

          {/* Admin Bilgileri */}
          <div className="card" style={{ padding: 24 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 4 }}>Admin Bilgileri 🔒</h2>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Bu alan yalnızca admin panelinde görünür, müşterilere gösterilmez.</p>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Ürün Kodu</label>
              <input
                className="form-input"
                value={productCode}
                onChange={(e) => setProductCode(e.target.value)}
                placeholder="KB-001"
                style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
              />
              <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>Örn: KB-001, SMK-02, KNK-03 — sipariş takibi ve stok yönetimi için</p>
            </div>
          </div>

          {/* SEO Tags */}
          <div className="card" style={{ padding: 24 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 4 }}>SEO Etiketleri 🔍</h2>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>Müşterilere gösterilmez — sadece arama motorları için JSON-LD&apos;ye gömülür.</p>
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
            <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 8 }}>Örn: kişiye özel kupa, sihirli kupa baskı, hediye kupa</p>
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
    </>
  );
}
