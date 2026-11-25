'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import '@/app/blog/blog.css';
import '@/app/admin/blog/blog-admin.css';
import { savePostAction, getProductOptionsAction } from '@/lib/actions-blog';
import { renderMarkdown, slugifyHeading } from '@/lib/markdown';
import { cloudinaryUrl } from '@/lib/format';
import { SITE_URL } from '@/lib/site';
import { trDayKey, trHour, trTime, TR_OFFSET_MS } from '@/lib/tr-time';
import { CATEGORIES } from '@/types';
import { uploadFiles } from '@/components/admin/upload';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { IconCamera, IconPlus, IconTrash } from '@/components/admin/icons';
import type { Post, FaqItem } from '@/lib/posts-types';

interface Props {
  initial?: Post;
  onSaved: () => void;
}

interface ProductOption { id: string; title: string; category: string }

/** datetime-local değeri (TSİ) → epoch ms */
function parseSchedule(v: string): number | undefined {
  const m = v.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);
  return m ? trTime(m[1], Number(m[2]), Number(m[3])) : undefined;
}

/** epoch ms → datetime-local değeri (TSİ) */
function formatSchedule(ts?: number): string {
  if (!ts) return '';
  const d = new Date(ts + TR_OFFSET_MS).toISOString();
  return `${trDayKey(ts)}T${String(trHour(ts)).padStart(2, '0')}:${d.slice(14, 16)}`;
}

async function uploadCover(file: File): Promise<string> {
  const { ids, failures } = await uploadFiles([file]);
  if (!ids[0]) throw new Error(failures[0]?.message || 'Görsel yüklenemedi.');
  return ids[0];
}

export default function PostEditor({ initial, onSaved }: Props) {
  const toast = useToast();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!initial);
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [cover, setCover] = useState<string | undefined>(initial?.coverImage);
  const [tags, setTags] = useState((initial?.tags ?? []).join(', '));
  const [faq, setFaq] = useState<FaqItem[]>(initial?.faq ?? []);
  const [productIds, setProductIds] = useState<string[]>(initial?.productIds ?? []);
  const [categories, setCategories] = useState<string[]>(initial?.categories ?? []);
  const [schedule, setSchedule] = useState(formatSchedule(initial?.scheduledAt));
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const coverRef = useRef<HTMLInputElement>(null);
  const inlineRef = useRef<HTMLInputElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  const isPublished = initial?.published ?? false;

  useEffect(() => {
    getProductOptionsAction().then(setProducts).catch(() => setProducts([]));
  }, []);

  const shownProducts = useMemo(() => {
    const q = productQuery.trim().toLocaleLowerCase('tr-TR');
    return products.filter((p) => !q || p.title.toLocaleLowerCase('tr-TR').includes(q) || p.category.toLocaleLowerCase('tr-TR').includes(q));
  }, [products, productQuery]);

  const onTitle = (v: string) => {
    setTitle(v);
    if (!slugTouched) setSlug(slugifyHeading(v));
  };

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

  const pickCover = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setUploading(true);
    setError('');
    try { setCover(await uploadCover(f)); } catch (e) { setError(errorMessage(e, 'Görsel yüklenemedi.')); } finally { setUploading(false); if (coverRef.current) coverRef.current.value = ''; }
  };

  const insertImage = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setUploading(true);
    setError('');
    try {
      const id = await uploadCover(f);
      const md = `\n\n![${title || 'Görsel'}](${id})\n\n`;
      const pos = areaRef.current?.selectionStart ?? content.length;
      setContent((c) => c.slice(0, pos) + md + c.slice(pos));
    } catch (e) {
      setError(errorMessage(e, 'Görsel yüklenemedi.'));
    } finally {
      setUploading(false);
      if (inlineRef.current) inlineRef.current.value = '';
    }
  };

  const save = async (publish: boolean) => {
    setBusy(true);
    setError('');
    try {
      const scheduledAt = !publish ? parseSchedule(schedule) : undefined;
      await savePostAction(
        {
          slug: slug.trim(),
          title: title.trim(),
          excerpt: excerpt.trim(),
          content,
          coverImage: cover,
          tags: tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10),
          faq: faq.filter((f) => f.q.trim() && f.a.trim()),
          productIds,
          categories,
          published: publish,
          ...(scheduledAt ? { scheduledAt } : {}),
          ...(initial?.auto ? { auto: true } : {}),
        },
        initial?.id,
      );
      toast.success(publish ? 'Yazı yayında.' : scheduledAt ? 'Yazı planlandı.' : 'Taslak kaydedildi.');
      onSaved();
    } catch (e) {
      setError(errorMessage(e, 'Kaydedilemedi.'));
      setBusy(false);
    }
  };

  const words = content.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="card blg-editor">
      <div className="form-group">
        <label className="form-label" htmlFor="blg-title">Başlık</label>
        <input id="blg-title" className="form-input" value={title} onChange={(e) => onTitle(e.target.value)} placeholder="Örn: Sihirli kupa nasıl çalışır?" />
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="blg-slug">Adres (slug)</label>
        <input
          id="blg-slug"
          className="form-input"
          value={slug}
          onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
          placeholder="sihirli-kupa-nasil-calisir"
        />
        <div className="blg-help">{SITE_URL}/blog/{slug || '…'}</div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="blg-excerpt">
          Kısa özet <span className={`blg-counter${excerpt.length > 160 ? ' is-over' : ''}`}>· arama sonucunda görünür ({excerpt.length}/160 ideal)</span>
        </label>
        <textarea id="blg-excerpt" className="form-textarea" rows={3} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} maxLength={320} />
      </div>

      <div className="form-group">
        <span className="form-label">Kapak görseli</span>
        <div className="blg-cover">
          {cover && (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="blg-cover-img" src={cloudinaryUrl(cover, 'f_auto,q_auto,w_320,h_180,c_fill')} alt="Kapak" />
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => coverRef.current?.click()} disabled={uploading}>
            <IconCamera size={16} /> {uploading ? 'Yükleniyor…' : cover ? 'Değiştir' : 'Görsel seç'}
          </button>
          {cover && <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCover(undefined)}>Kaldır</button>}
          <input ref={coverRef} type="file" accept="image/*" hidden onChange={(e) => pickCover(e.target.files)} />
        </div>
        {!cover && <div className="blg-help">Kapak eklemezseniz liste kartında düz bir zemin görünür.</div>}
      </div>

      <div className="form-group">
        <div className="blg-content-head">
          <label className="form-label" htmlFor="blg-content" style={{ margin: 0 }}>İçerik <span className="blg-counter">· {words} kelime</span></label>
          <div className="blg-content-tools">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => inlineRef.current?.click()} disabled={uploading}>Görsel ekle</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreview((p) => !p)}>{preview ? 'Düzenle' : 'Önizle'}</button>
          </div>
          <input ref={inlineRef} type="file" accept="image/*" hidden onChange={(e) => insertImage(e.target.files)} />
        </div>
        {preview ? (
          <article className="blog-prose blg-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
        ) : (
          <textarea
            id="blg-content"
            ref={areaRef}
            className="form-textarea blg-mono"
            rows={18}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={'## Alt başlık\n\nParagraf metni. **kalın**, *italik*, [bağlantı](/urun/ornek)\n\n- madde 1\n- madde 2'}
          />
        )}
        <div className="blg-help">## Başlık · **kalın** · *italik* · - liste · 1. numaralı liste · [metin](adres) · &gt; alıntı</div>
      </div>

      <div className="form-group">
        <label className="form-label" htmlFor="blg-tags">Etiketler <span className="blg-counter">· virgülle ayırın</span></label>
        <input id="blg-tags" className="form-input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="sihirli kupa, hediye, kupa baskı" />
      </div>

      <div className="form-group">
        <span className="form-label">İlgili kategoriler <span className="blg-counter">· ürün sayfalarında &quot;İlgili yazılar&quot; için</span></span>
        <div className="blg-chips">
          {CATEGORIES.map((c) => (
            <button key={c} type="button" className={`blg-chip${categories.includes(c) ? ' is-on' : ''}`} aria-pressed={categories.includes(c)} onClick={() => toggle(categories, setCategories, c)}>
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <span className="form-label">İlgili ürünler <span className="blg-counter">· {productIds.length} seçili; yazının sonunda kart olarak gösterilir</span></span>
        <input className="form-input" aria-label="Ürün ara" placeholder="Ürün ara…" value={productQuery} onChange={(e) => setProductQuery(e.target.value)} />
        <div className="blg-prodlist">
          {shownProducts.length === 0 && <span className="blg-help" style={{ padding: 8 }}>{products.length === 0 ? 'Ürünler yükleniyor ya da hiç ürün yok.' : 'Eşleşen ürün yok.'}</span>}
          {shownProducts.map((p) => (
            <label key={p.id} className="blg-prod">
              <input type="checkbox" checked={productIds.includes(p.id)} onChange={() => toggle(productIds, setProductIds, p.id)} />
              <span>{p.title}</span>
              <small>{p.category}</small>
            </label>
          ))}
        </div>
      </div>

      <div className="form-group">
        <span className="form-label">Sık sorulan sorular <span className="blg-counter">· arama ve yapay zekâ cevapları için değerli</span></span>
        {faq.map((f, i) => (
          <div key={i} className="blg-faq-item">
            <input className="form-input" aria-label="Soru" placeholder="Soru" value={f.q} onChange={(e) => setFaq((a) => a.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))} />
            <textarea className="form-textarea" aria-label="Cevap" rows={2} placeholder="Cevap" value={f.a} onChange={(e) => setFaq((a) => a.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))} />
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFaq((a) => a.filter((_, j) => j !== i))}><IconTrash size={14} /> Kaldır</button>
          </div>
        ))}
        {faq.length < 10 && (
          <button type="button" className="btn btn-secondary btn-sm" style={{ justifySelf: 'start' }} onClick={() => setFaq((a) => [...a, { q: '', a: '' }])}><IconPlus size={14} /> Soru ekle</button>
        )}
      </div>

      {!isPublished && (
        <div className="form-group">
          <label className="form-label" htmlFor="blg-schedule">Planlı yayın <span className="blg-counter">· Türkiye saati; boş bırakırsanız yalnızca taslak olur</span></label>
          <input id="blg-schedule" type="datetime-local" className="form-input" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
          <div className="blg-help">Planlı yazılar günde en fazla bir kez, vakti geldiğinde otomatik yayına çıkar.</div>
        </div>
      )}

      {error && <div className="blg-error" role="alert">{error}</div>}

      <div className="blg-actions">
        {isPublished ? (
          <>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => save(false)}>Taslağa al</button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => save(true)}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => save(false)}>{schedule ? 'Planla' : 'Taslak kaydet'}</button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => save(true)}>{busy ? 'Kaydediliyor…' : 'Şimdi yayınla'}</button>
          </>
        )}
      </div>
    </div>
  );
}
