'use client';

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { createPortal } from 'react-dom';
import { cloudinaryUrl } from '@/lib/products';
import { uploadFiles, type UploadFailure } from './upload';
import { IconCamera, IconClose, IconUpload } from './icons';

interface Props {
  images: string[];
  setImages: Dispatch<SetStateAction<string[]>>;
  /** Bu oturumda yüklenen yeni public_id'ler (kaydedilmezse temizlenir) */
  onUploaded: (ids: string[]) => void;
  /** Kullanıcı bir görseli kaldırdı */
  onRemove: (id: string) => void;
  onBusyChange?: (busy: boolean) => void;
  error?: string;
}

const THUMB = 'f_auto,q_auto,w_200,h_160,c_fill';

export default function ImageGallery({ images, setImages, onUploaded, onRemove, onBusyChange, error }: Props) {
  const [uploading, setUploading] = useState(false);
  const [failures, setFailures] = useState<UploadFailure[]>([]);
  const [dragOverZone, setDragOverZone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Sıralama — HTML5 drag + touch
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragIndexRef = useRef<number | null>(null);
  const [touchDragIndex, setTouchDragIndex] = useState<number | null>(null);
  const [touchGhostPos, setTouchGhostPos] = useState<{ x: number; y: number } | null>(null);
  const touchDragIndexRef = useRef<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Kamera
  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [mounted, setMounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { setMounted(true); }, []);

  const setBusy = (v: boolean) => {
    setUploading(v);
    onBusyChange?.(v);
  };

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

  useEffect(() => () => stopCamera(), [stopCamera]);

  const handleFiles = async (list: FileList | File[] | null) => {
    const files = list ? Array.from(list) : [];
    if (!files.length) return;
    setBusy(true);
    setFailures([]);
    try {
      const { ids, failures: failed } = await uploadFiles(files);
      if (ids.length) {
        onUploaded(ids);
        setImages((prev) => [...prev, ...ids]);
      }
      if (failed.length) setFailures(failed);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── Kamera ──────────────────────────────────────────────────────────────────

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
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setCameraError('Kameraya erişilemedi. Tarayıcı izinlerini kontrol edin.');
      setShowCamera(false);
      stopCamera();
      setFailures([{ name: 'Kamera', message: 'Kameraya erişilemedi. Tarayıcı izinlerini kontrol edin.' }]);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `kamera-${Date.now()}.jpg`, { type: 'image/jpeg' });
        stopCamera();
        void handleFiles([file]);
      },
      'image/jpeg',
      0.92
    );
  };

  // ── Sıralama (masaüstü) ─────────────────────────────────────────────────────

  const move = (from: number, to: number) => {
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleDrop = (e: React.DragEvent, to: number) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    if (from !== null && from !== to) move(from, to);
    dragIndexRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    dragIndexRef.current = null;
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // ── Sıralama (dokunmatik) ───────────────────────────────────────────────────

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const onTouchMove = (e: TouchEvent) => {
      if (touchDragIndexRef.current === null) return;
      e.preventDefault();
      const t = e.touches[0];
      setTouchGhostPos({ x: t.clientX, y: t.clientY });
      const el = document.elementFromPoint(t.clientX, t.clientY);
      const item = el?.closest('[data-img-index]') as HTMLElement | null;
      if (item) {
        const idx = parseInt(item.dataset.imgIndex ?? '-1', 10);
        if (idx >= 0) setDragOverIndex(idx);
      }
    };
    grid.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => grid.removeEventListener('touchmove', onTouchMove);
  }, [images.length]);

  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    touchDragIndexRef.current = index;
    setTouchDragIndex(index);
    const t = e.touches[0];
    setTouchGhostPos({ x: t.clientX, y: t.clientY });
    setDragOverIndex(index);
  };

  const handleTouchEnd = () => {
    const from = touchDragIndexRef.current;
    const to = dragOverIndex;
    if (from !== null && to !== null && from !== to) move(from, to);
    touchDragIndexRef.current = null;
    setTouchDragIndex(null);
    setTouchGhostPos(null);
    setDragOverIndex(null);
  };

  const remove = (id: string, index: number) => {
    onRemove(id);
    setImages((prev) => prev.filter((_, j) => j !== index));
  };

  return (
    <>
      {showCamera && mounted && createPortal(
        <div
          style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            zIndex: 99999, background: '#000', overflow: 'hidden', touchAction: 'none', transform: 'translateZ(0)',
          }}
        >
          {cameraError ? (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
              <p style={{ color: '#f85149', fontSize: 15, textAlign: 'center', padding: '0 32px' }}>{cameraError}</p>
              <button onClick={stopCamera} style={{ padding: '10px 28px', borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 14, cursor: 'pointer' }}>Kapat</button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onCanPlay={() => setCameraReady(true)}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
              <canvas ref={canvasRef} style={{ display: 'none' }} />
              <button
                type="button"
                onClick={stopCamera}
                aria-label="Kamerayı kapat"
                style={{
                  position: 'absolute', top: 20, right: 20, zIndex: 10, background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(255,255,255,0.25)', borderRadius: '50%', width: 44, height: 44,
                  color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <IconClose size={18} />
              </button>
              <div
                style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, display: 'flex',
                  justifyContent: 'center', alignItems: 'center', paddingTop: 24,
                  paddingBottom: 'max(40px, env(safe-area-inset-bottom, 40px))',
                  background: 'rgba(27,26,23,0.6)',
                }}
              >
                {!cameraReady ? (
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>Kamera başlatılıyor...</span>
                ) : (
                  <button
                    type="button"
                    onClick={capturePhoto}
                    aria-label="Fotoğraf çek"
                    style={{
                      width: 76, height: 76, borderRadius: '50%', background: '#fff',
                      border: '4px solid rgba(255,255,255,0.5)', boxShadow: '0 0 0 4px rgba(255,255,255,0.2)', cursor: 'pointer',
                    }}
                  />
                )}
              </div>
            </>
          )}
        </div>,
        document.body
      )}

      <div className="adm-upload-row">
        <div
          className={`adm-dropzone ${dragOverZone ? 'drag-over' : ''}`}
          role="button"
          tabIndex={0}
          aria-busy={uploading}
          onClick={() => !uploading && fileRef.current?.click()}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !uploading) { e.preventDefault(); fileRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); setDragOverZone(true); }}
          onDragLeave={() => setDragOverZone(false)}
          onDrop={(e) => { e.preventDefault(); setDragOverZone(false); void handleFiles(e.dataTransfer.files); }}
        >
          <IconUpload size={18} />
          {uploading ? 'Yükleniyor...' : 'Dosya seç veya sürükle'}
        </div>
        <button type="button" className="adm-camera-btn" onClick={startCamera} disabled={uploading}>
          <IconCamera size={20} />
          Kamera
        </button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => void handleFiles(e.target.files)}
      />

      {error && <div className="adm-field-error" role="alert">{error}</div>}

      {failures.length > 0 && (
        <div className="adm-upload-errors" role="alert">
          {failures.length} dosya yüklenemedi:
          <ul style={{ margin: '4px 0 0 18px' }}>
            {failures.map((f, i) => (
              <li key={`${f.name}-${i}`}>{f.name} — {f.message}</li>
            ))}
          </ul>
        </div>
      )}

      {images.length > 0 && (
        <>
          {images.length > 1 && (
            <p className="adm-help">Sıralamak için görselleri sürükleyin. İlk görsel ürünün kapak fotoğrafı olur.</p>
          )}
          {touchGhostPos && touchDragIndex !== null && (
            <div className="adm-thumb-ghost" style={{ left: touchGhostPos.x - 45, top: touchGhostPos.y - 38 }}>
              <img src={cloudinaryUrl(images[touchDragIndex], THUMB)} alt="" />
            </div>
          )}
          <div className="adm-thumbs" ref={gridRef}>
            {images.map((id, i) => (
              <div
                key={id}
                data-img-index={i}
                draggable
                className={[
                  'adm-thumb',
                  i === 0 ? 'is-cover' : '',
                  dragOverIndex === i && dragIndex !== i && touchDragIndex !== i ? 'is-over' : '',
                  dragIndex === i || touchDragIndex === i ? 'is-dragging' : '',
                ].join(' ')}
                onDragStart={() => { dragIndexRef.current = i; setDragIndex(i); }}
                onDragOver={(e) => { e.preventDefault(); if (dragIndexRef.current !== null) setDragOverIndex(i); }}
                onDrop={(e) => handleDrop(e, i)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleTouchStart(e, i)}
                onTouchEnd={handleTouchEnd}
              >
                <img src={cloudinaryUrl(id, THUMB)} alt={i === 0 ? 'Kapak görseli' : `Görsel ${i + 1}`} draggable={false} />
                <span className="adm-thumb-label">{i === 0 ? 'Kapak' : `#${i + 1}`}</span>
                <button
                  type="button"
                  className="adm-thumb-remove"
                  onClick={() => remove(id, i)}
                  aria-label={`Görseli kaldır (${i + 1})`}
                >
                  <IconClose size={12} />
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
