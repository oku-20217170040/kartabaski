'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Product, ProductColor, CATEGORIES, Category } from '@/types';
import ImageGallery from '@/components/admin/ImageGallery';
import ColorVariants from '@/components/admin/ColorVariants';
import { deleteUploaded, toSlug } from '@/components/admin/upload';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';

interface Props {
  initial?: Partial<Product>;
  onSubmit: (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  submitLabel: string;
}

type FieldErrors = Partial<Record<'title' | 'slug' | 'priceMin' | 'priceMax' | 'images' | 'deliveryDays', string>>;

const SLUG_RE = /^[a-z0-9-]+$/;

// Doğrulama sırasına göre ilk hatalı alanın DOM id'si
const FIELD_ORDER: (keyof FieldErrors)[] = ['title', 'slug', 'priceMin', 'priceMax', 'deliveryDays', 'images'];
const FIELD_IDS: Record<keyof FieldErrors, string> = {
  title: 'pf-title',
  slug: 'pf-slug',
  priceMin: 'pf-priceMin',
  priceMax: 'pf-priceMax',
  deliveryDays: 'pf-deliveryDays',
  images: 'pf-images',
};

export default function ProductForm({ initial, onSubmit, submitLabel }: Props) {
  const router = useRouter();
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [title, setTitle] = useState(initial?.title || '');
  const [slug, setSlug] = useState(initial?.slug || '');
  const [slugManual, setSlugManual] = useState(false);
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
  const [colors, setColors] = useState<ProductColor[]>(initial?.colors || []);

  const [galleryBusy, setGalleryBusy] = useState(false);
  const [colorBusy, setColorBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  // Bu oturumda yüklenen ve henüz kaydedilmemiş görseller
  const sessionUploads = useRef<Set<string>>(new Set());
  const savedRef = useRef(false);

  const isEdit = !!initial?.slug;
  const slugChanged = isEdit && slug !== initial?.slug;

  // ── Kaydedilmemiş değişiklik takibi ────────────────────────────────────────
  const snapshot = JSON.stringify({
    title, slug, priceMin, priceMax, category, active, deliveryDays,
    description, images, productCode, seoTags, colors,
  });
  const initialSnapshot = useRef<string | null>(null);
  if (initialSnapshot.current === null) initialSnapshot.current = snapshot;
  const dirtyRef = useRef(false);
  dirtyRef.current = snapshot !== initialSnapshot.current;

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current && !savedRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Uygulama içi bağlantılar (sidebar, geri, iptal) için onay
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current || savedRef.current) return;
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.('a');
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      let url: URL;
      try { url = new URL(a.href, window.location.href); } catch { return; }
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      e.preventDefault();
      e.stopPropagation();
      void confirm({
        title: 'Kaydedilmemiş değişiklikler var',
        message: 'Bu sayfadan ayrılırsanız yaptığınız değişiklikler ve yüklenen yeni görseller kaybolur.',
        confirmLabel: 'Sayfadan ayrıl',
        cancelLabel: 'Düzenlemeye devam et',
        danger: true,
      }).then((ok) => {
        if (ok) router.push(url.pathname + url.search + url.hash);
      });
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [confirm, router]);

  // Kaydedilmeden çıkılırsa yeni yüklenen görselleri temizle
  useEffect(() => {
    const uploads = sessionUploads.current;
    return () => {
      if (!savedRef.current && uploads.size > 0) {
        navigator.sendBeacon(
          '/api/cloudinary-delete',
          new Blob([JSON.stringify({ publicIds: Array.from(uploads) })], { type: 'application/json' })
        );
      }
    };
  }, []);

  // ── Alan işleyicileri ──────────────────────────────────────────────────────

  const clearError = (k: keyof FieldErrors) =>
    setErrors((prev) => (prev[k] ? { ...prev, [k]: undefined } : prev));

  const handleTitleChange = (v: string) => {
    setTitle(v);
    clearError('title');
    if (!initial?.slug && !slugManual) {
      setSlug(toSlug(v));
      clearError('slug');
    }
  };

  const handleSlugChange = (v: string) => {
    setSlugManual(true);
    setSlug(toSlug(v, { trimEnds: false }));
    clearError('slug');
  };

  const trackUpload = (ids: string[]) => ids.forEach((id) => sessionUploads.current.add(id));

  const handleRemoveImage = (id: string) => {
    // Yalnızca bu oturumda yüklenenler hemen silinir; mevcutlar kayıtta sunucuda temizlenir
    if (sessionUploads.current.has(id)) {
      sessionUploads.current.delete(id);
      deleteUploaded([id]);
    }
  };

  const addSeoTag = () => {
    const t = seoTagInput.trim();
    if (t && !seoTags.includes(t)) setSeoTags((prev) => [...prev, t]);
    setSeoTagInput('');
  };

  // ── Doğrulama ──────────────────────────────────────────────────────────────

  const validate = (): FieldErrors => {
    const e: FieldErrors = {};
    const finalSlug = toSlug(slug);

    if (!title.trim()) e.title = 'Başlık zorunludur.';

    if (!finalSlug) e.slug = 'Slug zorunludur.';
    else if (!SLUG_RE.test(finalSlug)) e.slug = 'Slug yalnızca küçük harf, rakam ve tire içerebilir.';

    const min = Number(priceMin);
    if (!priceMin.trim() || !Number.isFinite(min) || min <= 0) e.priceMin = 'Min fiyat 0\'dan büyük olmalıdır.';

    if (priceMax.trim()) {
      const max = Number(priceMax);
      if (!Number.isFinite(max) || max <= 0) e.priceMax = 'Geçerli bir fiyat girin.';
      else if (Number.isFinite(min) && max < min) e.priceMax = 'Max fiyat, min fiyattan küçük olamaz.';
    }

    const days = Number(deliveryDays);
    if (!deliveryDays.trim() || !Number.isInteger(days) || days < 1 || days > 30) {
      e.deliveryDays = 'Teslimat süresi 1 ile 30 arasında tam sayı olmalıdır.';
    }

    if (images.length < 1) e.images = 'En az 1 görsel eklemelisiniz.';

    return e;
  };

  const handleSubmit = async (ev?: React.FormEvent) => {
    ev?.preventDefault();
    if (saving) return;

    const v = validate();
    setErrors(v);
    const first = FIELD_ORDER.find((k) => v[k]);
    if (first) {
      setError('');
      toast.error('Lütfen formdaki hataları düzeltin.');
      const el = document.getElementById(FIELD_IDS[first]);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      (el as HTMLElement | null)?.focus?.({ preventScroll: true });
      return;
    }

    setSaving(true);
    setError('');
    // ÖNEMLİ: onSubmit içinde router.push çağrılırsa bileşen unmount olur ve
    // temizlik efekti çalışır. Yeni yüklenen görsellerin silinmemesi için
    // bayrak, kaydetme çağrısından ÖNCE kaldırılır; hata olursa geri alınır.
    savedRef.current = true;
    try {
      await onSubmit({
        title: title.trim(),
        slug: toSlug(slug),
        priceMin: Number(priceMin),
        priceMax: Number(priceMax) || 0,
        category,
        active,
        shortDesc: initial?.shortDesc || '',
        description,
        images,
        colors: colors.length > 0 ? colors : undefined,
        deliveryDays: Number(deliveryDays),
        seoTags,
        productCode: productCode.trim() || undefined,
      });
      sessionUploads.current.clear();
    } catch (e: unknown) {
      savedRef.current = false;
      const msg = errorMessage(e);
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || galleryBusy || colorBusy;

  const fieldProps = (k: keyof FieldErrors) => ({
    id: FIELD_IDS[k],
    'aria-invalid': errors[k] ? true : undefined,
    'aria-describedby': errors[k] ? `${FIELD_IDS[k]}-err` : undefined,
  });

  const FieldError = ({ k }: { k: keyof FieldErrors }) =>
    errors[k] ? <div id={`${FIELD_IDS[k]}-err`} className="adm-field-error" role="alert">{errors[k]}</div> : null;

  return (
    <form onSubmit={handleSubmit} noValidate className="adm-form-grid">
      {/* Sol sütun */}
      <div className="adm-form-col">
        <div className="card adm-card-pad">
          <h2 className="adm-card-title">Temel Bilgiler</h2>

          <div className="form-group">
            <label className="form-label" htmlFor="pf-title">Başlık *</label>
            <input
              {...fieldProps('title')}
              className={`form-input ${errors.title ? 'has-error' : ''}`}
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Sihirli Kupa - 330ml"
            />
            <FieldError k="title" />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="pf-slug">Slug (URL) *</label>
            <input
              {...fieldProps('slug')}
              className={`form-input ${errors.slug ? 'has-error' : ''}`}
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              onBlur={() => setSlug((s) => toSlug(s))}
              placeholder="sihirli-mat-kupa-330ml"
              autoCapitalize="none"
              spellCheck={false}
            />
            <FieldError k="slug" />
            {!errors.slug && <div className="adm-field-hint">Küçük harf, rakam ve tire. Türkçe karakterler otomatik dönüştürülür.</div>}
            {slugChanged && (
              <div className="adm-field-warn" role="note">
                Slug değiştiriliyor: URL değişir, eski bağlantılar kırılır.
              </div>
            )}
          </div>

          <div className="adm-field-row">
            <div className="form-group">
              <label className="form-label" htmlFor="pf-priceMin">Min Fiyat (TL) *</label>
              <input
                {...fieldProps('priceMin')}
                className={`form-input ${errors.priceMin ? 'has-error' : ''}`}
                type="number" inputMode="decimal" min="0" step="any"
                value={priceMin}
                onChange={(e) => { setPriceMin(e.target.value); clearError('priceMin'); clearError('priceMax'); }}
                placeholder="150"
              />
              <FieldError k="priceMin" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pf-priceMax">Max Fiyat (TL)</label>
              <input
                {...fieldProps('priceMax')}
                className={`form-input ${errors.priceMax ? 'has-error' : ''}`}
                type="number" inputMode="decimal" min="0" step="any"
                value={priceMax}
                onChange={(e) => { setPriceMax(e.target.value); clearError('priceMax'); }}
                placeholder="350"
              />
              <FieldError k="priceMax" />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="pf-deliveryDays">Teslimat (iş günü)</label>
              <input
                {...fieldProps('deliveryDays')}
                className={`form-input ${errors.deliveryDays ? 'has-error' : ''}`}
                type="number" inputMode="numeric" min="1" max="30" step="1"
                value={deliveryDays}
                onChange={(e) => { setDeliveryDays(e.target.value); clearError('deliveryDays'); }}
                placeholder="3"
              />
              <FieldError k="deliveryDays" />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="pf-category">Kategori</label>
            <select id="pf-category" className="form-select" value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="pf-description">Detaylı Açıklama</label>
            <textarea
              id="pf-description"
              className="form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ürün hakkında detaylı bilgi..."
              style={{ minHeight: 120 }}
            />
          </div>
        </div>

        <div className="card adm-card-pad" id="pf-images" tabIndex={-1}>
          <h2 className="adm-card-title">Görseller *</h2>
          <ImageGallery
            images={images}
            setImages={(u) => { setImages(u); clearError('images'); }}
            onUploaded={trackUpload}
            onRemove={handleRemoveImage}
            onBusyChange={setGalleryBusy}
            error={errors.images}
          />
        </div>

        <div className="card adm-card-pad">
          <h2 className="adm-card-title">Renk Varyantları</h2>
          <p className="adm-card-sub">
            Her renk için ayrı fotoğraf ekleyin. Müşteri ürün sayfasında renk seçip WhatsApp mesajına yansıtır.
          </p>
          <ColorVariants
            colors={colors}
            setColors={setColors}
            onUploaded={trackUpload}
            onRemoveImage={handleRemoveImage}
            onBusyChange={setColorBusy}
          />
        </div>
      </div>

      {/* Sağ sütun */}
      <div className="adm-form-col">
        <div className="card adm-card-pad">
          <h2 className="adm-card-title">Durum</h2>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="pf-active">Ürün Durumu</label>
            <select id="pf-active" className="form-select" value={String(active)} onChange={(e) => setActive(e.target.value === 'true')}>
              <option value="true">Aktif (sitede görünür)</option>
              <option value="false">Pasif (gizli)</option>
            </select>
          </div>
        </div>

        <div className="card adm-card-pad">
          <h2 className="adm-card-title">Admin Bilgileri</h2>
          <p className="adm-card-sub">Bu alan yalnızca admin panelinde görünür, müşterilere gösterilmez.</p>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="pf-code">Ürün Kodu</label>
            <input
              id="pf-code"
              className="form-input"
              value={productCode}
              onChange={(e) => setProductCode(e.target.value)}
              placeholder="KB-001"
              style={{ fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: '0.05em' }}
            />
            <div className="adm-field-hint">Örn: KB-001, SMK-02. Sipariş takibi ve stok yönetimi için.</div>
          </div>
        </div>

        <div className="card adm-card-pad">
          <h2 className="adm-card-title">SEO Etiketleri</h2>
          <p className="adm-card-sub">Müşterilere gösterilmez, yalnızca arama motorları için JSON-LD&apos;ye gömülür.</p>
          <div className="tags-wrap">
            {seoTags.map((t) => (
              <span key={t} className="tag-chip">
                {t}
                <button type="button" onClick={() => setSeoTags((prev) => prev.filter((x) => x !== t))} aria-label={`${t} etiketini kaldır`}>×</button>
              </span>
            ))}
            <input
              className="tags-input"
              placeholder="SEO etiketi ekle..."
              aria-label="SEO etiketi ekle"
              value={seoTagInput}
              onChange={(e) => setSeoTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addSeoTag(); } }}
              onBlur={addSeoTag}
            />
          </div>
          <div className="adm-field-hint" style={{ marginTop: 8 }}>Örn: kişiye özel kupa, sihirli kupa baskı, hediye kupa</div>
        </div>

        <div className="card adm-card-pad adm-sticky">
          {error && <div className="adm-alert" role="alert">{error}</div>}
          <button type="submit" className="btn btn-primary btn-full btn-lg" disabled={busy}>
            {saving ? 'Kaydediliyor...' : galleryBusy || colorBusy ? 'Görseller yükleniyor...' : submitLabel}
          </button>
          <Link href="/admin/products" className="btn btn-secondary btn-full" style={{ marginTop: 10 }}>
            İptal
          </Link>
        </div>
      </div>

      {dialog}
    </form>
  );
}
