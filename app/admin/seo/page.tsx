'use client';

import { useEffect, useRef, useState } from 'react';
import { getSeoSettingsAction, saveSeoSettingsAction } from '@/lib/actions-seo';
import { DEFAULT_SEO, SEO_LIMITS, type SeoSettings, type CategorySeo } from '@/lib/seo-settings';
import { SEO_TITLE_MAX, SEO_DESC_MAX, lengthStatus } from '@/lib/seo-meta';
import { SITE_URL } from '@/lib/site';
import { cloudinaryUrl } from '@/lib/format';
import { CATEGORIES } from '@/types';
import { uploadFiles } from '@/components/admin/upload';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { IconCamera, IconCheck, IconClose } from '@/components/admin/icons';
import './seo.css';

export default function SeoSettingsPage() {
  const toast = useToast();
  const [s, setS] = useState<SeoSettings>(DEFAULT_SEO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const ogRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSeoSettingsAction()
      .then(setS)
      .catch((e) => toast.error(errorMessage(e, 'SEO ayarları yüklenemedi.')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof SeoSettings>(k: K, v: SeoSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  const setCat = (cat: string, patch: Partial<CategorySeo>) =>
    setS((p) => {
      const next = { ...(p.categorySeo[cat] ?? {}), ...patch };
      const categorySeo = { ...p.categorySeo, [cat]: next };
      return { ...p, categorySeo };
    });

  const save = async () => {
    setSaving(true);
    try {
      setS(await saveSeoSettingsAction(s));
      toast.success('SEO ayarları kaydedildi.');
    } catch (e) {
      toast.error(errorMessage(e, 'Kaydedilemedi.'));
    } finally {
      setSaving(false);
    }
  };

  const pickOg = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const { ids, failures } = await uploadFiles([f]);
      if (!ids[0]) throw new Error(failures[0]?.message || 'Görsel yüklenemedi.');
      set('ogImage', ids[0]);
    } catch (e) {
      toast.error(errorMessage(e, 'Görsel yüklenemedi.'));
    } finally {
      setUploading(false);
      if (ogRef.current) ogRef.current.value = '';
    }
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><div className="spinner" /></div>;

  const titleStatus = lengthStatus(s.siteTitle, SEO_TITLE_MAX);
  const descStatus = lengthStatus(s.description, SEO_DESC_MAX);

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">SEO Ayarları</h1>
          <p className="adm-page-sub">Varsayılan başlık, açıklama ve doğrulama kodları. Kayıttan sonra site meta bilgileri yenilenir (en geç 1 saat).</p>
        </div>
        <button type="button" className="btn btn-primary adm-btn-icon-label" onClick={save} disabled={saving}>
          <IconCheck size={16} /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </div>

      <div className="seo-wrap">
        <section className="card adm-section" aria-labelledby="seo-meta">
          <h2 id="seo-meta" className="adm-section-title">Varsayılan meta</h2>
          <p className="seo-lead">Arama sonuçlarında ve paylaşımlarda ana sayfa için görünen bilgiler.</p>
          <div className="form-group">
            <label className="form-label" htmlFor="seo-title">
              Başlık <span className={`seo-count${titleStatus === 'long' ? ' is-over' : ''}`}>· {s.siteTitle.length}/{SEO_TITLE_MAX} ideal</span>
            </label>
            <input id="seo-title" className="form-input" value={s.siteTitle} maxLength={SEO_LIMITS.title} onChange={(e) => set('siteTitle', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="seo-desc">
              Açıklama <span className={`seo-count${descStatus === 'long' ? ' is-over' : ''}`}>· {s.description.length}/{SEO_DESC_MAX} ideal</span>
            </label>
            <textarea id="seo-desc" className="form-textarea" rows={3} value={s.description} maxLength={SEO_LIMITS.description} onChange={(e) => set('description', e.target.value)} />
          </div>
          <div className="seo-serp" aria-label="Arama sonucu önizlemesi">
            <div className="seo-serp-url">{SITE_URL.replace(/^https?:\/\//, '')}</div>
            <div className="seo-serp-title">{s.siteTitle || '—'}</div>
            <div className="seo-serp-desc">{s.description || '—'}</div>
          </div>
        </section>

        <TagSection
          title="Anahtar kelimeler"
          lead="Meta anahtar kelimeleri; sitenin hedeflediği aramalar."
          tags={s.keywords}
          onChange={(v) => set('keywords', v)}
          placeholder="ör: isimli kupa baskı"
        />

        <TagSection
          title="Anahtar kelime hedefleri"
          lead="Blog otomasyonu bu kelimelerden yeni yazı konuları üretir (her kelime için bir rehber yazısı)."
          tags={s.keywordTargets}
          onChange={(v) => set('keywordTargets', v)}
          placeholder="ör: fotoğraflı kupa fiyatları"
        />

        <TagSection
          title="Kargo yapılan iller / hedef şehirler"
          lead="Türkiye geneline gönderim yapıyorsunuz; öne çıkarmak istediğiniz şehirleri ekleyin."
          tags={s.targetCities}
          onChange={(v) => set('targetCities', v)}
          placeholder="ör: İzmir"
        />

        <section className="card adm-section" aria-labelledby="seo-og">
          <h2 id="seo-og" className="adm-section-title">Paylaşım görseli (OG)</h2>
          <p className="seo-lead">WhatsApp, Instagram ve sosyal medyada site bağlantısı paylaşılınca görünen görsel. Önerilen oran 1200 x 630.</p>
          <div className="seo-og">
            {s.ogImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="seo-og-img" src={cloudinaryUrl(s.ogImage, 'f_auto,q_auto,w_380,h_200,c_fill')} alt="Paylaşım görseli" />
            ) : (
              <span className="seo-help">Seçilmedi: logo kullanılır.</span>
            )}
            <button type="button" className="btn btn-secondary btn-sm adm-btn-icon-label" onClick={() => ogRef.current?.click()} disabled={uploading}>
              <IconCamera size={16} /> {uploading ? 'Yükleniyor…' : s.ogImage ? 'Değiştir' : 'Görsel seç'}
            </button>
            {s.ogImage && <button type="button" className="btn btn-secondary btn-sm" onClick={() => set('ogImage', '')}>Kaldır</button>}
            <input ref={ogRef} type="file" accept="image/*" hidden onChange={(e) => pickOg(e.target.files)} />
          </div>
        </section>

        <section className="card adm-section" aria-labelledby="seo-verify">
          <h2 id="seo-verify" className="adm-section-title">Doğrulama kodları</h2>
          <p className="seo-lead">Search Console ve Bing Webmaster size bir kod verir. Yalnızca kodu ya da tüm meta etiketini yapıştırabilirsiniz.</p>
          <div className="form-group">
            <label className="form-label" htmlFor="seo-google">Google Search Console</label>
            <input id="seo-google" className="form-input" value={s.googleVerification} onChange={(e) => set('googleVerification', e.target.value)} placeholder="google-site-verification kodu" autoComplete="off" />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="seo-bing">Bing Webmaster</label>
            <input id="seo-bing" className="form-input" value={s.bingVerification} onChange={(e) => set('bingVerification', e.target.value)} placeholder="msvalidate.01 kodu" autoComplete="off" />
          </div>
        </section>

        <section className="card adm-section" aria-labelledby="seo-cats">
          <h2 id="seo-cats" className="adm-section-title">Kategori SEO metinleri</h2>
          <p className="seo-lead">Her kategori için özel başlık, açıklama ve tanıtım metni. Boş bırakılan alanlar için varsayılanlar kullanılır.</p>
          {CATEGORIES.map((c) => {
            const v = s.categorySeo[c] ?? {};
            const filled = !!(v.title || v.description || v.intro);
            return (
              <details key={c} className="seo-cat">
                <summary>{c}<span className="seo-cat-state">{filled ? 'Dolu' : 'Boş'}</span></summary>
                <div className="seo-cat-body">
                  <div className="form-group">
                    <label className="form-label" htmlFor={`cat-t-${c}`}>Başlık</label>
                    <input id={`cat-t-${c}`} className="form-input" value={v.title ?? ''} maxLength={SEO_LIMITS.title} onChange={(e) => setCat(c, { title: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor={`cat-d-${c}`}>Açıklama</label>
                    <textarea id={`cat-d-${c}`} className="form-textarea" rows={2} value={v.description ?? ''} maxLength={SEO_LIMITS.description} onChange={(e) => setCat(c, { description: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor={`cat-i-${c}`}>Tanıtım metni</label>
                    <textarea id={`cat-i-${c}`} className="form-textarea" rows={4} value={v.intro ?? ''} maxLength={SEO_LIMITS.intro} onChange={(e) => setCat(c, { intro: e.target.value })} />
                  </div>
                </div>
              </details>
            );
          })}
        </section>

        <section className="card adm-section" aria-labelledby="seo-extra">
          <h2 id="seo-extra" className="adm-section-title">Ek açıklama</h2>
          <p className="seo-lead">İşletmeniz hakkında arama motorlarına aktarmak istediğiniz ek bilgi.</p>
          <textarea className="form-textarea" aria-label="Ek açıklama" rows={4} value={s.extraDescription} maxLength={SEO_LIMITS.extra} onChange={(e) => set('extraDescription', e.target.value)} placeholder="ör: Tek adetten toplu siparişe kişiye özel kupa baskı…" />
        </section>

        <div className="seo-bar">
          <button type="button" className="btn btn-primary adm-btn-icon-label" onClick={save} disabled={saving}>
            <IconCheck size={16} /> {saving ? 'Kaydediliyor…' : 'Kaydet'}
          </button>
        </div>
      </div>
    </div>
  );
}

function TagSection({ title, lead, tags, onChange, placeholder }: {
  title: string;
  lead: string;
  tags: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');
  const add = () => {
    const v = input.trim();
    setInput('');
    if (!v || tags.some((t) => t.toLocaleLowerCase('tr-TR') === v.toLocaleLowerCase('tr-TR'))) return;
    onChange([...tags, v]);
  };
  return (
    <section className="card adm-section">
      <h2 className="adm-section-title">{title}</h2>
      <p className="seo-lead">{lead}</p>
      {tags.length > 0 && (
        <div className="seo-tags">
          {tags.map((t) => (
            <span key={t} className="seo-tag">
              {t}
              <button type="button" aria-label={`${t} kaldır`} onClick={() => onChange(tags.filter((x) => x !== t))}><IconClose size={14} /></button>
            </span>
          ))}
        </div>
      )}
      <div className="seo-tag-add">
        <input
          className="form-input"
          aria-label={`${title} ekle`}
          value={input}
          placeholder={placeholder}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
        />
        <button type="button" className="btn btn-secondary" onClick={add}>Ekle</button>
      </div>
      <div className="seo-help">Enter ile ekleyin.</div>
    </section>
  );
}
