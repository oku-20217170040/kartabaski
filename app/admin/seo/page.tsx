'use client';

import { useEffect, useState } from 'react';
import { getSeoSettings, saveSeoSettings, SeoSettings, DEFAULT_SEO } from '@/lib/seo-settings';

export default function SeoSettingsPage() {
  const [settings, setSettings] = useState<SeoSettings>(DEFAULT_SEO);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Etiket input state'leri
  const [areaInput, setAreaInput] = useState('');
  const [serviceInput, setServiceInput] = useState('');
  const [keywordInput, setKeywordInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('');

  useEffect(() => {
    getSeoSettings().then(setSettings).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await saveSeoSettings(settings);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const addTag = (field: keyof Pick<SeoSettings, 'serviceAreas' | 'services' | 'keywords' | 'featuredCategories'>, value: string) => {
    const v = value.trim();
    if (!v || settings[field].includes(v)) return;
    setSettings(s => ({ ...s, [field]: [...s[field], v] }));
  };

  const removeTag = (field: keyof Pick<SeoSettings, 'serviceAreas' | 'services' | 'keywords' | 'featuredCategories'>, value: string) => {
    setSettings(s => ({ ...s, [field]: s[field].filter(x => x !== value) }));
  };

  const handleTagInput = (
    e: React.KeyboardEvent<HTMLInputElement>,
    field: keyof Pick<SeoSettings, 'serviceAreas' | 'services' | 'keywords' | 'featuredCategories'>,
    inputValue: string,
    setInput: (v: string) => void,
  ) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(field, inputValue);
      setInput('');
    }
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><div className="spinner" /></div>;
  }

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem' }}>SEO Ayarları</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>
            Buradaki bilgiler kullanıcılara gösterilmez — Google'ın sitenizi daha iyi anlaması için arka planda çalışır.
          </p>
        </div>
        <button
          className={`btn ${saved ? 'btn-secondary' : 'btn-primary'}`}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Kaydediliyor...' : saved ? '✓ Kaydedildi' : 'Kaydet'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 720 }}>

        {/* Hizmet Bölgeleri */}
        <TagSection
          title="Hizmet Bölgeleri"
          description="Hangi ilçe ve mahallelere hizmet veriyorsunuz?"
          tags={settings.serviceAreas}
          inputValue={areaInput}
          onInputChange={setAreaInput}
          onKeyDown={(e) => handleTagInput(e, 'serviceAreas', areaInput, setAreaInput)}
          onAdd={() => { addTag('serviceAreas', areaInput); setAreaInput(''); }}
          onRemove={(v) => removeTag('serviceAreas', v)}
          placeholder="ör: Esenyurt, Silivri..."
        />

        {/* Yapılan İşler */}
        <TagSection
          title="Yapılan İşler / Hizmetler"
          description="İşletmenizin sunduğu hizmetler nelerdir?"
          tags={settings.services}
          inputValue={serviceInput}
          onInputChange={setServiceInput}
          onKeyDown={(e) => handleTagInput(e, 'services', serviceInput, setServiceInput)}
          onAdd={() => { addTag('services', serviceInput); setServiceInput(''); }}
          onRemove={(v) => removeTag('services', v)}
          placeholder="ör: İkinci el koltuk alımı..."
        />

        {/* Anahtar Kelimeler */}
        <TagSection
          title="Anahtar Kelimeler"
          description="Google'da aranmasını istediğiniz kelimeler"
          tags={settings.keywords}
          inputValue={keywordInput}
          onInputChange={setKeywordInput}
          onKeyDown={(e) => handleTagInput(e, 'keywords', keywordInput, setKeywordInput)}
          onAdd={() => { addTag('keywords', keywordInput); setKeywordInput(''); }}
          onRemove={(v) => removeTag('keywords', v)}
          placeholder="ör: spot mobilya, ikinci el buzdolabı..."
        />

        {/* Öne Çıkan Kategoriler */}
        <TagSection
          title="Öne Çıkan Ürün Kategorileri"
          description="En çok sattığınız ürün grupları"
          tags={settings.featuredCategories}
          inputValue={categoryInput}
          onInputChange={setCategoryInput}
          onKeyDown={(e) => handleTagInput(e, 'featuredCategories', categoryInput, setCategoryInput)}
          onAdd={() => { addTag('featuredCategories', categoryInput); setCategoryInput(''); }}
          onRemove={(v) => removeTag('featuredCategories', v)}
          placeholder="ör: Koltuk Takımı, Çamaşır Makinesi..."
        />

        {/* Çalışma Saatleri */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Çalışma Saatleri</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Google'ın göstereceği çalışma saatleri</div>
          </div>
          <input
            className="form-input"
            value={settings.workingHours}
            onChange={(e) => setSettings(s => ({ ...s, workingHours: e.target.value }))}
            placeholder="ör: Pazartesi-Pazar 09:00-00:00"
          />
        </div>

        {/* Ek Açıklama */}
        <div className="card" style={{ padding: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Ek Açıklama</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>İşletmeniz hakkında Google'a aktarmak istediğiniz ek bilgiler</div>
          </div>
          <textarea
            className="form-input"
            value={settings.extraDescription}
            onChange={(e) => setSettings(s => ({ ...s, extraDescription: e.target.value }))}
            placeholder="ör: Esenyurt'un en köklü spot mağazası. 10 yıllık tecrübe..."
            rows={4}
            style={{ resize: 'vertical' }}
          />
        </div>

        <button
          className={`btn ${saved ? 'btn-secondary' : 'btn-primary'}`}
          onClick={handleSave}
          disabled={saving}
          style={{ alignSelf: 'flex-start' }}
        >
          {saving ? 'Kaydediliyor...' : saved ? '✓ Kaydedildi' : 'Kaydet'}
        </button>
      </div>
    </div>
  );
}

// ── Etiket Bölümü ─────────────────────────────────────────────────────────────

function TagSection({
  title, description, tags, inputValue, onInputChange, onKeyDown, onAdd, onRemove, placeholder,
}: {
  title: string;
  description: string;
  tags: string[];
  inputValue: string;
  onInputChange: (v: string) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onAdd: () => void;
  onRemove: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--muted)' }}>{description}</div>
      </div>

      {/* Mevcut etiketler */}
      {tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {tags.map((tag) => (
            <span
              key={tag}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px', borderRadius: 100,
                background: 'rgba(47,129,247,0.1)', border: '1px solid rgba(47,129,247,0.25)',
                color: 'var(--accent2)', fontSize: 13,
              }}
            >
              {tag}
              <button
                onClick={() => onRemove(tag)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 14, lineHeight: 1, padding: 0 }}
              >×</button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          className="form-input"
          value={inputValue}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          style={{ flex: 1 }}
        />
        <button className="btn btn-secondary btn-sm" onClick={onAdd} style={{ whiteSpace: 'nowrap' }}>
          + Ekle
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
        Enter veya virgül ile ekle
      </div>
    </div>
  );
}
