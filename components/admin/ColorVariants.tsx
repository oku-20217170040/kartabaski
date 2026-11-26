'use client';

import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { ProductColor } from '@/types';
import { cloudinaryUrl } from '@/lib/products';
import { uploadFiles, type UploadFailure } from './upload';
import { IconClose, IconGrip, IconUpload } from './icons';

interface Props {
  colors: ProductColor[];
  setColors: Dispatch<SetStateAction<ProductColor[]>>;
  onUploaded: (ids: string[]) => void;
  onRemoveImage: (id: string) => void;
  onBusyChange?: (busy: boolean) => void;
}

const THUMB = 'f_auto,q_auto,w_200,h_160,c_fill';

export default function ColorVariants({ colors, setColors, onUploaded, onRemoveImage, onBusyChange }: Props) {
  const [newName, setNewName] = useState('');
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [failures, setFailures] = useState<{ color: string; items: UploadFailure[] } | null>(null);

  // Varyant sıralama
  const [dragColor, setDragColor] = useState<number | null>(null);
  const [overColor, setOverColor] = useState<number | null>(null);
  // Varyant içi görsel sıralama
  const imgDrag = useRef<{ ci: number; ii: number } | null>(null);
  const [imgOver, setImgOver] = useState<{ ci: number; ii: number } | null>(null);

  const addColor = () => {
    const name = newName.trim();
    if (!name) return;
    setColors((prev) => [...prev, { name, images: [] }]);
    setNewName('');
  };

  const removeColor = (ci: number) => {
    // Bu oturumda yüklenmiş görseller varsa hemen temizlenir (parent karar verir)
    colors[ci]?.images.forEach(onRemoveImage);
    setColors((prev) => prev.filter((_, j) => j !== ci));
  };

  const handleUpload = async (ci: number, list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    if (!files.length) return;
    setUploadingIndex(ci);
    onBusyChange?.(true);
    setFailures(null);
    try {
      const { ids, failures: failed } = await uploadFiles(files);
      if (ids.length) {
        onUploaded(ids);
        setColors((prev) => prev.map((c, i) => (i === ci ? { ...c, images: [...c.images, ...ids] } : c)));
      }
      if (failed.length) setFailures({ color: colors[ci]?.name ?? '', items: failed });
    } finally {
      setUploadingIndex(null);
      onBusyChange?.(false);
    }
  };

  const removeImage = (ci: number, ii: number, id: string) => {
    onRemoveImage(id);
    setColors((prev) => prev.map((c, i) => (i === ci ? { ...c, images: c.images.filter((_, j) => j !== ii) } : c)));
  };

  const swap = <T,>(list: T[], a: number, b: number) => {
    const next = [...list];
    [next[a], next[b]] = [next[b], next[a]];
    return next;
  };
  const moveColor = (from: number, to: number) => setColors((prev) => swap(prev, from, to));
  const makeCover = (ci: number, ii: number) =>
    setColors((prev) => prev.map((c, i) => (i === ci ? { ...c, images: [c.images[ii], ...c.images.filter((_, j) => j !== ii)] } : c)));

  const dropColor = (e: React.DragEvent, to: number) => {
    e.preventDefault();
    if (dragColor !== null && dragColor !== to) {
      const from = dragColor;
      setColors((prev) => {
        const next = [...prev];
        const [m] = next.splice(from, 1);
        next.splice(to, 0, m);
        return next;
      });
    }
    setDragColor(null);
    setOverColor(null);
  };

  const dropImage = (e: React.DragEvent, ci: number, to: number) => {
    e.preventDefault();
    const src = imgDrag.current;
    if (src && src.ci === ci && src.ii !== to) {
      setColors((prev) =>
        prev.map((c, i) => {
          if (i !== ci) return c;
          const imgs = [...c.images];
          const [m] = imgs.splice(src.ii, 1);
          imgs.splice(to, 0, m);
          return { ...c, images: imgs };
        })
      );
    }
    imgDrag.current = null;
    setImgOver(null);
  };

  return (
    <div>
      <div className="adm-color-add">
        <input
          className="form-input"
          placeholder="Renk adı, örn: Turuncu, Koyu Mavi"
          aria-label="Yeni renk adı"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addColor(); } }}
        />
        <button type="button" onClick={addColor} disabled={!newName.trim()} className="btn btn-secondary">
          Renk Ekle
        </button>
      </div>

      {colors.length === 0 && <p className="adm-muted-center">Henüz renk varyantı eklenmedi.</p>}

      {failures && (
        <div className="adm-upload-errors" role="alert" style={{ marginBottom: 12 }}>
          {failures.color}: {failures.items.length} dosya yüklenemedi
          <ul style={{ margin: '4px 0 0 18px' }}>
            {failures.items.map((f, i) => <li key={`${f.name}-${i}`}>{f.name} — {f.message}</li>)}
          </ul>
        </div>
      )}

      {colors.map((color, ci) => (
        <div
          key={ci}
          draggable
          className={`adm-color ${overColor === ci && dragColor !== ci ? 'is-over' : ''} ${dragColor === ci ? 'is-dragging' : ''}`}
          onDragStart={() => setDragColor(ci)}
          onDragOver={(e) => { e.preventDefault(); if (dragColor !== null) setOverColor(ci); }}
          onDrop={(e) => dropColor(e, ci)}
          onDragEnd={() => { setDragColor(null); setOverColor(null); }}
        >
          <div className="adm-color-head">
            <div className="adm-color-name">
              <span className="grip"><IconGrip size={16} /></span>
              <span>{color.name}</span>
            </div>
            <div className="adm-color-tools">
              {colors.length > 1 && (
                <>
                  <button type="button" className="adm-icon-btn" disabled={ci === 0} onClick={() => moveColor(ci, ci - 1)} aria-label={`${color.name} rengini yukarı taşı`}>↑</button>
                  <button type="button" className="adm-icon-btn" disabled={ci === colors.length - 1} onClick={() => moveColor(ci, ci + 1)} aria-label={`${color.name} rengini aşağı taşı`}>↓</button>
                </>
              )}
              <button type="button" className="adm-link-danger" onClick={() => removeColor(ci)}>Sil</button>
            </div>
          </div>

          {color.images.length > 1 && (
            <p className="adm-help" style={{ marginTop: 0 }}>Sıralamak için sürükleyin. İlk görsel varyantın kapağıdır.</p>
          )}

          <div className="adm-thumbs" style={{ marginTop: 0 }}>
            {color.images.map((id, ii) => {
              const isDragging = imgDrag.current?.ci === ci && imgDrag.current?.ii === ii;
              const isOver = imgOver?.ci === ci && imgOver?.ii === ii && !isDragging;
              return (
                <div
                  key={id}
                  draggable
                  className={`adm-thumb ${ii === 0 ? 'is-cover' : ''} ${isOver ? 'is-over' : ''}`}
                 
                  onDragStart={(e) => { e.stopPropagation(); imgDrag.current = { ci, ii }; }}
                  onDragOver={(e) => { e.stopPropagation(); e.preventDefault(); if (imgDrag.current) setImgOver({ ci, ii }); }}
                  onDrop={(e) => { e.stopPropagation(); dropImage(e, ci, ii); }}
                  onDragEnd={(e) => { e.stopPropagation(); imgDrag.current = null; setImgOver(null); }}
                >
                  <img src={cloudinaryUrl(id, THUMB)} alt="" draggable={false} />
                  {ii === 0
                    ? <span className="adm-thumb-label">Kapak</span>
                    : <button type="button" className="adm-thumb-cover" onClick={() => makeCover(ci, ii)}>Kapak yap</button>}
                  <button
                    type="button"
                    className="adm-thumb-remove"
                   
                    onClick={() => removeImage(ci, ii, id)}
                    aria-label={`${color.name} görselini kaldır`}
                  >
                    <IconClose size={10} />
                  </button>
                </div>
              );
            })}

            <label className="adm-thumb-add" style={{ cursor: uploadingIndex === ci ? 'wait' : 'pointer' }}>
              <IconUpload size={16} />
              <span>{uploadingIndex === ci ? 'Yükleniyor' : 'Ekle'}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(e) => { void handleUpload(ci, e.target.files); e.target.value = ''; }}
                disabled={uploadingIndex !== null}
              />
            </label>
          </div>
        </div>
      ))}
    </div>
  );
}
