'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { getProducts, getProductById, cloudinaryThumb, formatPriceRange } from '@/lib/products';
import {
  createProductAction,
  deleteProductAction,
  toggleFeaturedAction,
  toggleActiveAction,
} from '@/lib/actions';
import { Product, CATEGORIES } from '@/types';
import { getActive, getPriceMin, getPriceMax } from '@/lib/product-utils';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { IconBox, IconCopy, IconEdit, IconExternal, IconPlus, IconStar, IconTrash } from '@/components/admin/icons';

type StatusFilter = 'all' | 'active' | 'passive';
type FeaturedFilter = 'all' | 'featured' | 'normal';
type SortKey = 'newest' | 'name' | 'price-asc' | 'price-desc';

export default function AdminProductsPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [featuredFilter, setFeaturedFilter] = useState<FeaturedFilter>('all');
  const [sort, setSort] = useState<SortKey>('newest');

  // İşlem yapılan ürün id'leri
  const [busy, setBusy] = useState<Record<string, 'delete' | 'active' | 'featured' | 'copy' | undefined>>({});
  const setBusyFor = (id: string, v: 'delete' | 'active' | 'featured' | 'copy' | undefined) =>
    setBusy((prev) => ({ ...prev, [id]: v }));

  const load = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setProducts(await getProducts());
    } catch {
      setLoadError(true);
      toast.error('Ürünler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('tr-TR');
    const list = products.filter((p) => {
      if (q) {
        const hit =
          p.title.toLocaleLowerCase('tr-TR').includes(q) ||
          p.category.toLocaleLowerCase('tr-TR').includes(q) ||
          (p.productCode?.toLocaleLowerCase('tr-TR').includes(q) ?? false);
        if (!hit) return false;
      }
      if (category && p.category !== category) return false;
      if (status === 'active' && !getActive(p)) return false;
      if (status === 'passive' && getActive(p)) return false;
      if (featuredFilter === 'featured' && !p.featured) return false;
      if (featuredFilter === 'normal' && p.featured) return false;
      return true;
    });

    const sorted = [...list];
    switch (sort) {
      case 'name':
        sorted.sort((a, b) => a.title.localeCompare(b.title, 'tr'));
        break;
      case 'price-asc':
        sorted.sort((a, b) => getPriceMin(a) - getPriceMin(b));
        break;
      case 'price-desc':
        sorted.sort((a, b) => getPriceMin(b) - getPriceMin(a));
        break;
      default:
        sorted.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }
    return sorted;
  }, [products, search, category, status, featuredFilter, sort]);

  // ── Aksiyonlar ──────────────────────────────────────────────────────────────

  const handleDelete = async (p: Product) => {
    const ok = await confirm({
      title: 'Ürün silinsin mi?',
      message: (
        <>
          <strong>{p.title}</strong> ve görselleri kalıcı olarak silinecek. Bu işlem geri alınamaz.
        </>
      ),
      confirmLabel: 'Sil',
      danger: true,
    });
    if (!ok) return;

    setBusyFor(p.id, 'delete');
    try {
      await deleteProductAction(p.id);
      setProducts((prev) => prev.filter((x) => x.id !== p.id));
      toast.success(`"${p.title}" silindi.`);
    } catch (e) {
      toast.error(errorMessage(e, 'Ürün silinemedi.'));
    } finally {
      setBusyFor(p.id, undefined);
    }
  };

  const handleToggleFeatured = async (p: Product) => {
    const next = !p.featured;
    setBusyFor(p.id, 'featured');
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, featured: next } : x)));
    try {
      await toggleFeaturedAction(p.id, next);
      toast.success(next ? 'Öne çıkarıldı.' : 'Öne çıkarma kaldırıldı.');
    } catch (e) {
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, featured: p.featured } : x)));
      toast.error(errorMessage(e, 'Öne çıkarma değiştirilemedi.'));
    } finally {
      setBusyFor(p.id, undefined);
    }
  };

  const handleToggleActive = async (p: Product) => {
    const prevActive = getActive(p);
    const next = !prevActive;
    setBusyFor(p.id, 'active');
    setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: next } : x)));
    try {
      await toggleActiveAction(p.id, next);
      toast.success(next ? 'Ürün aktifleştirildi.' : 'Ürün pasife alındı.');
    } catch (e) {
      setProducts((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: prevActive } : x)));
      toast.error(errorMessage(e, 'Durum değiştirilemedi.'));
    } finally {
      setBusyFor(p.id, undefined);
    }
  };

  const handleDuplicate = async (p: Product) => {
    setBusyFor(p.id, 'copy');
    try {
      const source = (await getProductById(p.id)) ?? p;
      const { id: _id, ...rest } = source;
      void _id;

      // Benzersiz slug: slug-kopya, slug-kopya-2, ...
      const taken = new Set(products.map((x) => x.slug));
      const base = `${source.slug}-kopya`;
      let slug = base;
      for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

      const now = Date.now();
      const newId = await createProductAction({
        ...rest,
        title: `${source.title} (Kopya)`,
        slug,
        active: false,
        featured: false,
        productCode: undefined,
        createdAt: now,
        updatedAt: now,
      });
      toast.success('Ürün kopyalandı (pasif olarak eklendi).');
      const created = await getProductById(newId);
      if (created) setProducts((prev) => [created, ...prev]);
      else await load();
    } catch (e) {
      toast.error(errorMessage(e, 'Ürün kopyalanamadı.'));
    } finally {
      setBusyFor(p.id, undefined);
    }
  };

  const featuredCount = products.filter((p) => p.featured).length;
  const activeCount = products.filter((p) => getActive(p)).length;
  const hasFilters = !!(search || category || status !== 'all' || featuredFilter !== 'all');

  const clearFilters = () => {
    setSearch('');
    setCategory('');
    setStatus('all');
    setFeaturedFilter('all');
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">Ürünler</h1>
          <p className="adm-page-sub">
            {products.length} ürün · {activeCount} aktif · {featuredCount} öne çıkan
          </p>
        </div>
        <Link href="/admin/products/new" className="btn btn-primary adm-btn-icon-label">
          <IconPlus size={16} /> Yeni Ürün
        </Link>
      </div>

      {/* Araç çubuğu */}
      <div className="adm-toolbar">
        <input
          className="form-input"
          placeholder="Ürün, kategori veya kod ara..."
          aria-label="Ürün ara"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="form-select" aria-label="Kategori" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Tüm kategoriler</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="form-select" aria-label="Durum" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
          <option value="all">Tüm durumlar</option>
          <option value="active">Aktif</option>
          <option value="passive">Pasif</option>
        </select>
        <select className="form-select" aria-label="Öne çıkan" value={featuredFilter} onChange={(e) => setFeaturedFilter(e.target.value as FeaturedFilter)}>
          <option value="all">Öne çıkan: hepsi</option>
          <option value="featured">Yalnızca öne çıkanlar</option>
          <option value="normal">Öne çıkmayanlar</option>
        </select>
        <select className="form-select" aria-label="Sırala" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="newest">En yeni</option>
          <option value="name">Ada göre (A-Z)</option>
          <option value="price-asc">Fiyat (artan)</option>
          <option value="price-desc">Fiyat (azalan)</option>
        </select>
        {hasFilters && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={clearFilters}>Filtreleri temizle</button>
        )}
        <span className="adm-toolbar-count" aria-live="polite">{filtered.length} sonuç</span>
      </div>

      {loading ? (
        <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
          <div className="spinner" />
        </div>
      ) : loadError ? (
        <div className="adm-empty">
          <div className="adm-empty-title">Ürünler yüklenemedi</div>
          <button type="button" className="btn btn-secondary" onClick={load}>Tekrar dene</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="adm-empty">
          <div className="adm-empty-title">Ürün bulunamadı</div>
          {hasFilters && <button type="button" className="btn btn-secondary" onClick={clearFilters}>Filtreleri temizle</button>}
        </div>
      ) : (
        <div className="adm-list">
          {filtered.map((p) => {
            const thumb = p.images?.[0] ? cloudinaryThumb(p.images[0]) : null;
            const active = getActive(p);
            const b = busy[p.id];

            return (
              <div key={p.id} className={`card adm-row ${active ? '' : 'is-inactive'}`}>
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt={p.title} className="adm-row-thumb" />
                ) : (
                  <div className="adm-row-thumb"><IconBox size={24} /></div>
                )}

                <div className="adm-row-main">
                  <div className="adm-row-title">
                    {p.featured && <span className="adm-star-on"><IconStar size={15} filled aria-label="Öne çıkan" role="img" /></span>}
                    <span>{p.title}</span>
                  </div>
                  <div className="adm-row-slug">
                    <span>/{p.slug}</span>
                    {p.productCode && <span className="adm-code">{p.productCode}</span>}
                  </div>
                  <div className="adm-row-meta">
                    <span className="adm-price">{formatPriceRange(getPriceMin(p), getPriceMax(p))}</span>
                    <span className="badge badge-muted">{p.category}</span>
                  </div>
                </div>

                <div className="adm-row-actions">
                  <button
                    type="button"
                    onClick={() => handleToggleActive(p)}
                    disabled={!!b}
                    className={`adm-status ${active ? 'on' : 'off'}`}
                    aria-pressed={active}
                    title={active ? 'Pasife al' : 'Aktifleştir'}
                  >
                    {active ? 'Aktif' : 'Pasif'}
                  </button>

                  <div className="adm-row-buttons">
                    <button
                      type="button"
                      className={`adm-icon-btn ${p.featured ? 'is-on' : ''}`}
                      onClick={() => handleToggleFeatured(p)}
                      disabled={!!b}
                      aria-pressed={!!p.featured}
                      title={p.featured ? 'Öne çıkarmayı kaldır' : 'Öne çıkar'}
                      aria-label={p.featured ? 'Öne çıkarmayı kaldır' : 'Öne çıkar'}
                    >
                      <IconStar filled={!!p.featured} />
                    </button>
                    <Link
                      href={`/urun/${p.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="adm-icon-btn"
                      title="Sitede gör"
                      aria-label="Sitede gör"
                    >
                      <IconExternal />
                    </Link>
                    <button
                      type="button"
                      className="adm-icon-btn"
                      onClick={() => handleDuplicate(p)}
                      disabled={!!b}
                      title="Kopyala"
                      aria-label="Kopyala"
                    >
                      {b === 'copy' ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <IconCopy />}
                    </button>
                    <Link href={`/admin/products/${p.id}`} className="btn btn-secondary btn-sm adm-btn-icon-label">
                      <IconEdit size={15} /> Düzenle
                    </Link>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm adm-btn-icon-label"
                      onClick={() => handleDelete(p)}
                      disabled={!!b}
                    >
                      <IconTrash size={15} /> {b === 'delete' ? 'Siliniyor...' : 'Sil'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {dialog}
    </div>
  );
}
