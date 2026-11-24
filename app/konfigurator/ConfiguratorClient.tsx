'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cloudinaryUrl } from '@/lib/format';
import { WHATSAPP_BASE } from '@/lib/constants';
import { ConfiguratorCup, ConfiguratorDesign } from '@/types';
import { WhatsAppIcon, CheckIcon } from '@/components/icons';

type Cup = ConfiguratorCup;
type Design = ConfiguratorDesign;

const CUSTOM_ID = '__custom__';
const ALL = 'Tümü';
const IMG_OPTS = 'f_auto,q_auto,w_600,h_600,c_fill';

const img = (id: string) => cloudinaryUrl(id, IMG_OPTS);
const fmtPrice = (n: number) => `${n.toLocaleString('tr-TR')} ₺`;

function buildWaUrl(cup: Cup, design: Design | null, colorName?: string | null): string {
  const cupLabel = `${cup.name} (${cup.code})${colorName ? `, ${colorName}` : ''}`;
  const msg =
    !design || design.id === CUSTOM_ID
      ? `Merhaba, ${cupLabel} bardağına kendi tasarımımı bastırmak istiyorum. Bilgi alabilir miyim?`
      : `Merhaba, ${cupLabel} bardağına "${design.name}" (${design.code}) tasarımını bastırmak istiyorum. Bilgi alabilir miyim?`;
  return `${WHATSAPP_BASE}?text=${encodeURIComponent(msg)}`;
}

function Thumb({ publicId, alt, name }: { publicId?: string; alt: string; name: string }) {
  return (
    <span className="cf-thumb">
      {publicId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img(publicId)} alt={alt} loading="lazy" decoding="async" />
      ) : (
        <span className="cf-ph">{name}</span>
      )}
    </span>
  );
}

function Placeholder({ text }: { text: string }) {
  return <span className="cf-thumb"><span className="cf-ph">{text}</span></span>;
}

export default function ConfiguratorClient() {
  const [cups, setCups] = useState<Cup[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [cupId, setCupId] = useState<string | null>(null);
  const [colorIdx, setColorIdx] = useState<number | null>(null);
  const [designId, setDesignId] = useState<string | null>(null);
  const [tab, setTab] = useState(ALL);

  useEffect(() => {
    Promise.all([
      getDocs(query(collection(db, 'configurator_cups'), orderBy('order'))),
      getDocs(query(collection(db, 'configurator_designs'), orderBy('order'))),
    ])
      .then(([cs, ds]) => {
        setCups(cs.docs.map((d) => ({ id: d.id, ...d.data() } as Cup)).filter((c) => c.active));
        setDesigns(ds.docs.map((d) => ({ id: d.id, ...d.data() } as Design)).filter((d) => d.active));
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  const cup = cups.find((c) => c.id === cupId) ?? null;
  const colors = useMemo(() => cup?.colors?.filter((c) => c.images[0]) ?? [], [cup]);
  const color = colorIdx !== null ? colors[colorIdx] ?? null : null;
  const isCustom = designId === CUSTOM_ID;
  const design = isCustom ? null : designs.find((d) => d.id === designId) ?? null;
  const hasDesign = isCustom || !!design;

  const cats = useMemo(
    () => [ALL, ...Array.from(new Set(designs.map((d) => d.category).filter(Boolean) as string[]))],
    [designs],
  );
  const shown = tab === ALL ? designs : designs.filter((d) => d.category === tab);

  const cupImage = color ? color.images[0] : cup?.imagePublicId;
  const designLabel = isCustom ? 'Kendi tasarımım' : design?.name ?? null;
  const customDesign = { id: CUSTOM_ID, code: 'ÖZEL', name: 'Kendi Tasarımım' } as Design;
  const waHref = cup ? buildWaUrl(cup, isCustom ? customDesign : design, color?.name) : '#';
  const ctaLabel = !cup
    ? 'Önce bir bardak seçin'
    : !hasDesign
      ? 'Bir tasarım seçin'
      : isCustom
        ? 'Kendi tasarımım için yazın'
        : 'WhatsApp ile sipariş verin';

  function reset() {
    setCupId(null);
    setColorIdx(null);
    setDesignId(null);
    setTab(ALL);
  }

  const cta = (cls: string) => (
    <a
      className={`btn btn-primary ${cls}`}
      href={waHref}
      target="_blank"
      rel="noopener noreferrer"
      aria-disabled={!cup}
      onClick={(e) => { if (!cup) e.preventDefault(); }}
      data-disabled={!cup || undefined}
    >
      <WhatsAppIcon size={18} /> {ctaLabel}
    </a>
  );

  return (
    <>
      <div className="page-head">
        <div className="wrap">
          <nav aria-label="Sayfa yolu">
            <ol className="breadcrumb">
              <li><Link href="/">Ana sayfa</Link></li>
              <li aria-current="page">Kendin tasarla</li>
            </ol>
          </nav>
          <p className="eyebrow" style={{ marginTop: 20 }}>Kendin tasarla</p>
          <h1 className="display">Bardağı ve tasarımı siz eşleştirin.</h1>
          <p className="lead">Modeli, rengi ve hazır tasarımı seçin; kombinasyonu görün, tek tıkla WhatsApp üzerinden bize iletin.</p>
        </div>
      </div>

      <div className="wrap cf-layout">
        <aside className="cf-preview" aria-label="Seçiminiz">
          <div className="cf-stage">
            <div className="cf-stage-slot">
              {cup ? <Thumb publicId={cupImage} alt={cup.name} name={cup.name} /> : <Placeholder text="Bardak seçin" />}
            </div>
            <span className="cf-plus" aria-hidden="true">+</span>
            <div className="cf-stage-slot">
              {isCustom ? (
                <Placeholder text="Kendi tasarımınız" />
              ) : design ? (
                <Thumb publicId={design.imagePublicId} alt={design.name} name={design.name} />
              ) : (
                <Placeholder text="Tasarım seçin" />
              )}
            </div>
          </div>

          <dl className="cf-summary">
            <div><dt>Bardak</dt><dd>{cup ? <>{cup.name} <small>{cup.code}</small></> : <span className="cf-muted">Seçilmedi</span>}</dd></div>
            {colors.length > 0 && (
              <div><dt>Renk</dt><dd>{color ? color.name : 'Standart'}</dd></div>
            )}
            <div><dt>Tasarım</dt><dd>{designLabel ? <>{designLabel}{design && <small>{design.code}</small>}</> : <span className="cf-muted">Seçilmedi</span>}</dd></div>
            {cup && cup.price > 0 && (
              <div className="cf-total"><dt>Fiyat</dt><dd>{fmtPrice(cup.price)}</dd></div>
            )}
          </dl>

          <p className="cf-note">Tasarım ücretsiz, baskı onayınızdan sonra 3 iş günü içinde kargoya verilir.</p>
          {cta('btn-block cf-cta')}
          <button type="button" className="btn btn-outline btn-sm btn-block cf-reset" onClick={reset} disabled={!cup && !designId}>
            Seçimi sıfırla
          </button>
        </aside>

        <div className="cf-steps">
          {loading ? (
            <div aria-busy="true" aria-label="Yükleniyor">
              <div className="skeleton" style={{ height: 28, width: 180, marginBottom: 20 }} />
              <div className="cf-grid">
                {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '1 / 1.2' }} />)}
              </div>
            </div>
          ) : failed ? (
            <p className="cf-empty">Seçenekler şu an yüklenemedi. Lütfen sayfayı yenileyin ya da WhatsApp üzerinden bize yazın.</p>
          ) : (
            <>
              <section className="cf-step" aria-labelledby="cf-s1">
                <h2 id="cf-s1" className="cf-step-title"><span>01</span> Bardak</h2>
                {cups.length === 0 ? (
                  <p className="cf-empty">Henüz bardak eklenmemiş.</p>
                ) : (
                  <div className="cf-grid">
                    {cups.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="cf-card"
                        aria-pressed={c.id === cupId}
                        onClick={() => { if (c.id !== cupId) { setCupId(c.id); setColorIdx(null); } }}
                      >
                        <Thumb publicId={c.imagePublicId} alt={c.name} name={c.name} />
                        <span className="cf-card-name">{c.name}</span>
                        <span className="cf-card-meta">{c.code}{c.price > 0 ? ` · ${fmtPrice(c.price)}` : ''}</span>
                        {c.id === cupId && <span className="cf-tick" aria-hidden="true"><CheckIcon size={14} /></span>}
                      </button>
                    ))}
                  </div>
                )}
              </section>

              {colors.length > 0 && cup && (
                <section className="cf-step" aria-labelledby="cf-s2">
                  <h2 id="cf-s2" className="cf-step-title"><span>02</span> Renk</h2>
                  <div className="cf-grid">
                    <button type="button" className="cf-card" aria-pressed={colorIdx === null} onClick={() => setColorIdx(null)}>
                      <Thumb publicId={cup.imagePublicId} alt="Standart" name="Standart" />
                      <span className="cf-card-name">Standart</span>
                    </button>
                    {colors.map((c, i) => (
                      <button key={c.name + i} type="button" className="cf-card" aria-pressed={colorIdx === i} onClick={() => setColorIdx(i)}>
                        <Thumb publicId={c.images[0]} alt={`${cup.name}, ${c.name}`} name={c.name} />
                        <span className="cf-card-name">{c.name}</span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              <section className="cf-step" aria-labelledby="cf-s3">
                <h2 id="cf-s3" className="cf-step-title"><span>{colors.length > 0 && cup ? '03' : '02'}</span> Tasarım</h2>
                {cats.length > 2 && (
                  <div className="chips cf-chips" role="group" aria-label="Tasarım kategorisi">
                    {cats.map((c) => (
                      <button key={c} type="button" className="chip" aria-pressed={tab === c} onClick={() => setTab(c)}>{c}</button>
                    ))}
                  </div>
                )}
                <div className="cf-grid">
                  {tab === ALL && (
                    <button type="button" className="cf-card" aria-pressed={isCustom} onClick={() => setDesignId(isCustom ? null : CUSTOM_ID)}>
                      <Placeholder text="Kendi tasarımınız" />
                      <span className="cf-card-name">Kendi tasarımım</span>
                      <span className="cf-card-meta">Fotoğraf, logo ya da yazı</span>
                      {isCustom && <span className="cf-tick" aria-hidden="true"><CheckIcon size={14} /></span>}
                    </button>
                  )}
                  {shown.map((d) => (
                    <button key={d.id} type="button" className="cf-card" aria-pressed={d.id === designId} onClick={() => setDesignId(d.id === designId ? null : d.id)}>
                      <Thumb publicId={d.imagePublicId} alt={d.name} name={d.name} />
                      <span className="cf-card-name">{d.name}</span>
                      <span className="cf-card-meta">{d.code}</span>
                      {d.id === designId && <span className="cf-tick" aria-hidden="true"><CheckIcon size={14} /></span>}
                    </button>
                  ))}
                </div>
                {shown.length === 0 && tab !== ALL && <p className="cf-empty">Bu kategoride tasarım yok.</p>}
              </section>
            </>
          )}
        </div>
      </div>

      <div className="cf-bar" role="region" aria-label="Seçim özeti">
        <div className="cf-bar-text">
          <strong>{cup ? cup.name : 'Bardak seçin'}</strong>
          <small>{designLabel ?? 'Tasarım seçilmedi'}{cup && cup.price > 0 ? ` · ${fmtPrice(cup.price)}` : ''}</small>
        </div>
        {cta('cf-bar-cta')}
      </div>
    </>
  );
}
