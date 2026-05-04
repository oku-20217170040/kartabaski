'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ConfiguratorCup, ConfiguratorDesign } from '@/types';

type Cup    = ConfiguratorCup;
type Design = ConfiguratorDesign;

const WA_NUMBER = '905458266508';
const CF_CLOUD  = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dwulzfmlu';

function cfImg(publicId: string, w = 400) {
  return `https://res.cloudinary.com/${CF_CLOUD}/image/upload/f_auto,q_auto,w_${w},c_fill/${publicId}`;
}

const CUSTOM_DESIGN: Design = {
  id: '__custom__',
  code: 'ÖZEL',
  name: 'Kendi Tasarımım',
  gradient: 'linear-gradient(135deg,#1A1A2E,#16213E)',
  textColor: '#C9A84C',
  active: true,
  order: 0,
  createdAt: 0,
  updatedAt: 0,
};

function buildWaUrl(cup: Cup, design: Design, colorName?: string | null): string {
  const cupLabel = colorName ? `${cup.name} (${colorName})` : cup.name;
  const msg = design.id === '__custom__'
    ? `Merhaba, ${cupLabel} bardağına kendi tasarımımı bastırmak istiyorum. Bilgi alabilir miyim?`
    : `Merhaba, ${cupLabel} bardağına "${design.name}" tasarımını bastırmak istiyorum. Bilgi alabilir miyim?`;
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}

/* ─── CAROUSEL ───────────────────────────────────────────────── */
const CARD_W   = 148; // px — kart genişliği
const CARD_GAP = 12;  // px — kartlar arası boşluk
const SCROLL_STEP = (CARD_W + CARD_GAP) * 3; // 3 kart kadar kaydır

function Carousel({ children, id }: { children: React.ReactNode; id: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft,  setCanLeft]  = useState(false);
  const [canRight, setCanRight] = useState(true);

  function updateArrows() {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => { el.removeEventListener('scroll', updateArrows); ro.disconnect(); };
  }, []);

  // children değişince (veriler yüklendi) okları güncelle
  useEffect(() => { setTimeout(updateArrows, 80); }, [children]);

  function scroll(dir: 'left' | 'right') {
    trackRef.current?.scrollBy({ left: dir === 'left' ? -SCROLL_STEP : SCROLL_STEP, behavior: 'smooth' });
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Sol ok */}
      {canLeft && (
        <button
          aria-label="Geri"
          onClick={() => scroll('left')}
          style={arrowStyle('left')}
        >‹</button>
      )}

      {/* Kaydırılabilir track */}
      <div
        ref={trackRef}
        id={id}
        style={{
          display: 'flex',
          gap: CARD_GAP,
          overflowX: 'auto',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          padding: '6px 4px 12px',
        }}
        // hide scrollbar on webkit
        className="hide-scrollbar"
      >
        {children}
      </div>

      {/* Sağ ok */}
      {canRight && (
        <button
          aria-label="İleri"
          onClick={() => scroll('right')}
          style={arrowStyle('right')}
        >›</button>
      )}
    </div>
  );
}

function arrowStyle(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute',
    top: '50%',
    [side]: -16,
    transform: 'translateY(-60%)',
    zIndex: 10,
    width: 34,
    height: 34,
    borderRadius: '50%',
    background: '#fff',
    border: '1.5px solid #E5E7EB',
    boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
    cursor: 'pointer',
    fontSize: 20,
    fontWeight: 700,
    color: '#374151',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    padding: 0,
  };
}

/* ─── MAIN COMPONENT ─────────────────────────────────────────── */
export default function ConfiguratorClient() {
  const [cups,           setCups]           = useState<Cup[]>([]);
  const [designs,        setDesigns]        = useState<Design[]>([]);
  const [dataLoading,    setDataLoading]    = useState(true);
  const [expandedCupId,    setExpandedCupId]    = useState<string | null>(null);
  const [selectedCup,      setSelectedCup]      = useState<Cup | null>(null);
  const [selectedColorIdx, setSelectedColorIdx] = useState<number | null>(null);
  const [selectedDesign,   setSelectedDesign]   = useState<Design | null>(null);
  const [designTab,        setDesignTab]        = useState<string>('Tümü');
  const variantPanelRef = useRef<HTMLDivElement>(null);
  const [toast,          setToast]          = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      getDocs(query(collection(db, 'configurator_cups'),    orderBy('order'))),
      getDocs(query(collection(db, 'configurator_designs'), orderBy('order'))),
    ]).then(([cupsSnap, designsSnap]) => {
      setCups(cupsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Cup)).filter(c => c.active));
      setDesigns(designsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Design)).filter(d => d.active));
      setDataLoading(false);
    }).catch(() => setDataLoading(false));
  }, []);

  const designsRef = useRef<HTMLElement>(null);
  const previewRef = useRef<HTMLElement>(null);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 2800);
  }

  function handleCupClick(cup: Cup) {
    const colors = cup.colors?.filter(c => c.images[0]) ?? [];
    if (colors.length === 0) {
      // Varyant yok — direkt seç/kaldır
      if (selectedCup?.id === cup.id) { setSelectedCup(null); setSelectedColorIdx(null); setExpandedCupId(null); return; }
      setSelectedCup(cup); setSelectedColorIdx(null); setExpandedCupId(null);
      if (!selectedDesign) setTimeout(() => designsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } else {
      // Varyant var — paneli aç/kapat
      setExpandedCupId(prev => prev === cup.id ? null : cup.id);
      setTimeout(() => variantPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
    }
  }

  function handleSelectVariant(cup: Cup, colorIdx: number | null) {
    if (selectedCup?.id === cup.id && selectedColorIdx === colorIdx) {
      setSelectedCup(null); setSelectedColorIdx(null); setExpandedCupId(null); return;
    }
    setSelectedCup(cup);
    setSelectedColorIdx(colorIdx);
    setExpandedCupId(null);
    if (!selectedDesign) setTimeout(() => designsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }

  function handleSelectDesign(design: Design) {
    if (selectedDesign?.id === design.id) { setSelectedDesign(null); return; }
    setSelectedDesign(design);
    if (selectedCup) {
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  }

  const bothSelected = !!(selectedCup && selectedDesign);
  const selectedColor = selectedCup && selectedColorIdx !== null
    ? selectedCup.colors?.filter(c => c.images[0])[selectedColorIdx] ?? null
    : null;
  const previewCupImg = selectedColor
    ? cfImg(selectedColor.images[0], 200)
    : selectedCup?.imagePublicId ? cfImg(selectedCup.imagePublicId, 200) : null;

  if (dataLoading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  );

  return (
    <>
      {/* hide-scrollbar global style */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar{display:none}
        .design-cat-select{display:none}
        @media(max-width:600px){
          .design-cat-tabs{display:none}
          .design-cat-select{display:block}
        }
      `}</style>

      {/* ── Header ───────────────────────────────────────────── */}
      <header style={{
        background: '#fff',
        borderBottom: '1px solid #E5E7EB',
        padding: '18px 20px 16px',
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 13, color: '#6B7280', textDecoration: 'none',
            marginBottom: 10,
          }}>
            ← Ürünlere Dön
          </Link>
          <h1 style={{ fontSize: 'clamp(1.4rem,4vw,2rem)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            Kendi <span style={{ color: '#FF6B35' }}>Kombinasyonunu</span> Oluştur
          </h1>
          <p style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>
            Bardağını seç, tasarımını seç — biz basalım.
          </p>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px 80px', display: 'flex', flexDirection: 'column', gap: 40 }}>

        {/* ── 1. BARDAK SEÇİMİ ─────────────────────────────── */}
        <section>
          <SectionTitle number={1} title="Bardağını Seç" />
          {cups.length === 0 ? (
            <p style={{ color: '#6B7280', fontSize: 14 }}>Henüz bardak eklenmemiş.</p>
          ) : (
            <>
              <Carousel id="cups-track">
                {cups.map((cup) => (
                  <CupCard
                    key={cup.id}
                    cup={cup}
                    expanded={expandedCupId === cup.id}
                    selected={selectedCup?.id === cup.id}
                    onClick={() => handleCupClick(cup)}
                  />
                ))}
              </Carousel>

              {/* Varyant paneli — seçilen bardağın altında açılır */}
              {(() => {
                const expandedCup = cups.find(c => c.id === expandedCupId);
                if (!expandedCup) return null;
                const colors = expandedCup.colors?.filter(c => c.images[0]) ?? [];
                if (colors.length === 0) return null;
                return (
                  <div
                    ref={variantPanelRef}
                    style={{
                      marginTop: 12,
                      background: '#fff',
                      border: '2px solid #FF6B35',
                      borderRadius: 12,
                      padding: '20px 20px 16px',
                      animation: 'galleryFadeIn 0.2s ease',
                    }}
                  >
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 14 }}>
                      {expandedCup.name} — Renk Seç
                    </p>
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {/* Renksiz (ana bardak) seçeneği */}
                      <button
                        onClick={() => handleSelectVariant(expandedCup, null)}
                        style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                        }}
                      >
                        <div style={{
                          width: 72, height: 72, borderRadius: 10, overflow: 'hidden',
                          background: '#f3f4f6',
                          outline: selectedCup?.id === expandedCup.id && selectedColorIdx === null ? '3px solid #FF6B35' : '2px solid #E5E7EB',
                          outlineOffset: 2, transition: 'outline-color 0.12s',
                        }}>
                          {expandedCup.imagePublicId
                            ? <img src={cfImg(expandedCup.imagePublicId, 144)} alt="Standart" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> // eslint-disable-line @next/next/no-img-element
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>☕</div>
                          }
                        </div>
                        <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>Standart</span>
                      </button>

                      {colors.map((c, i) => (
                        <button
                          key={i}
                          onClick={() => handleSelectVariant(expandedCup, i)}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          }}
                        >
                          <div style={{
                            width: 72, height: 72, borderRadius: 10, overflow: 'hidden',
                            outline: selectedCup?.id === expandedCup.id && selectedColorIdx === i ? '3px solid #FF6B35' : '2px solid #E5E7EB',
                            outlineOffset: 2, transition: 'outline-color 0.12s',
                          }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={cfImg(c.images[0], 144)} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                          </div>
                          <span style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{c.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </section>

        {/* ── 2. TASARIM SEÇİMİ ────────────────────────────── */}
        <section ref={designsRef}>
          <SectionTitle number={2} title="Tasarımını Seç" />

          {/* Kategori sekmeleri */}
          {(() => {
            const cats = ['Tümü', ...Array.from(new Set(designs.map(d => d.category).filter(Boolean) as string[]))];
            const filtered = designTab === 'Tümü' ? designs : designs.filter(d => d.category === designTab);
            return (
              <>
                {/* Masaüstü: pill sekmeler */}
                <div className="design-cat-tabs" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  {cats.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setDesignTab(cat)}
                      style={{
                        padding: '6px 14px', borderRadius: 20, border: '1.5px solid',
                        borderColor: designTab === cat ? '#FF6B35' : '#E5E7EB',
                        background: designTab === cat ? '#FF6B35' : '#fff',
                        color: designTab === cat ? '#fff' : '#374151',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >{cat}</button>
                  ))}
                </div>

                {/* Mobil: açılır liste */}
                <div className="design-cat-select" style={{ marginBottom: 16 }}>
                  <select
                    value={designTab}
                    onChange={e => setDesignTab(e.target.value)}
                    style={{
                      width: '100%', padding: '10px 14px',
                      borderRadius: 10, border: '1.5px solid #E5E7EB',
                      fontSize: 14, fontWeight: 600, color: '#374151',
                      background: '#fff', cursor: 'pointer',
                      appearance: 'none',
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236B7280' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
                      backgroundRepeat: 'no-repeat',
                      backgroundPosition: 'right 12px center',
                      paddingRight: 36,
                    }}
                  >
                    {cats.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>

                <Carousel id="designs-track">
                  {/* Kendi tasarımı kartı — sadece Tümü sekmesinde */}
                  {designTab === 'Tümü' && (
                    <CarouselCard
                      selected={selectedDesign?.id === '__custom__'}
                      onClick={() => handleSelectDesign(CUSTOM_DESIGN)}
                      highlight
                    >
                      <div style={{
                        width: '100%', aspectRatio: '1/1',
                        borderRadius: 8,
                        background: 'linear-gradient(135deg,#1A1A2E,#16213E)',
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        marginBottom: 8, gap: 4,
                      }}>
                        <span style={{ fontSize: '1.6rem' }}>🖼️</span>
                        <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#C9A84C', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Kendi</span>
                      </div>
                      <div style={{ ...itemNameStyle, color: '#1A1A1A', fontWeight: 700 }}>Kendi Tasarımım</div>
                    </CarouselCard>
                  )}

                  {filtered.map((design) => (
                    <CarouselCard
                      key={design.id}
                      selected={selectedDesign?.id === design.id}
                      onClick={() => handleSelectDesign(design)}
                    >
                      <Visual imagePublicId={design.imagePublicId} background={design.gradient ?? ''} color={design.textColor ?? ''} label={design.code} emoji="🎨" />
                      <div style={itemNameStyle}>{design.name}</div>
                    </CarouselCard>
                  ))}
                </Carousel>
              </>
            );
          })()}
        </section>

        {/* ── 3. ÖNİZLEME ──────────────────────────────────── */}
        <section
          ref={previewRef}
          style={{
            opacity: bothSelected ? 1 : 0,
            transform: bothSelected ? 'translateY(0)' : 'translateY(16px)',
            transition: 'opacity 0.35s ease, transform 0.35s ease',
            pointerEvents: bothSelected ? 'auto' : 'none',
          }}
        >
          <SectionTitle number={3} title="Kombinasyonun" />

          <div style={{
            background: '#fff',
            borderRadius: 12,
            border: '2px solid #E5E7EB',
            padding: '28px 24px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            {/* Görseller yan yana */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 20, flexWrap: 'wrap' }}>
              {selectedCup && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 100, height: 100, borderRadius: 12,
                    background: previewCupImg ? '#f3f4f6' : selectedCup.gradient,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '1.3rem', color: selectedCup.textColor,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.13)', overflow: 'hidden',
                  }}>
                    {previewCupImg ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={selectedColorIdx ?? 'base'} src={previewCupImg} alt={selectedCup.name} style={{ width: '100%', height: '100%', objectFit: 'cover', animation: 'galleryFadeIn 0.25s ease' }} />
                    ) : (
                      <><span>{selectedCup.code}</span><span style={{ fontSize: '0.7rem', opacity: 0.8 }}>☕</span></>
                    )}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>
                    {selectedCup.name}{selectedColor ? ` — ${selectedColor.name}` : ''}
                  </span>
                </div>
              )}

              <span style={{ fontSize: '2rem', color: '#FF6B35', fontWeight: 800 }}>+</span>

              {selectedDesign && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 100, height: 100, borderRadius: 12,
                    background: selectedDesign.id === '__custom__'
                      ? 'linear-gradient(135deg,#1A1A2E,#16213E)'
                      : selectedDesign.imagePublicId ? '#f3f4f6' : selectedDesign.gradient,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '1.3rem', color: selectedDesign.textColor,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.13)', overflow: 'hidden',
                  }}>
                    {selectedDesign.id === '__custom__' ? (
                      <><span style={{ fontSize: '2rem' }}>🖼️</span><span style={{ fontSize: '0.6rem', color: '#C9A84C', fontWeight: 700 }}>ÖZEL</span></>
                    ) : selectedDesign.imagePublicId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cfImg(selectedDesign.imagePublicId, 200)} alt={selectedDesign.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <><span>{selectedDesign.code}</span><span style={{ fontSize: '0.7rem', opacity: 0.8 }}>🎨</span></>
                    )}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>{selectedDesign.name}</span>
                </div>
              )}
            </div>

            {/* Kombino adı + fiyat */}
            {bothSelected && (
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
                  {selectedDesign!.id === '__custom__'
                    ? `${selectedCup!.name} bardağına kendi tasarımın`
                    : `${selectedCup!.name} + ${selectedDesign!.name}`}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 22, fontWeight: 800, color: '#FF6B35' }}>{selectedCup!.price}₺</span>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    <Chip green>✓ Ücretsiz Tasarım</Chip>
                    <Chip>🚚 3 İş Günü Teslimat</Chip>
                  </div>
                </div>
              </div>
            )}

            {/* WhatsApp butonu */}
            <a
              href={bothSelected ? buildWaUrl(selectedCup!, selectedDesign!, selectedColor?.name) : '#'}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => { if (!bothSelected) { e.preventDefault(); showToast('Lütfen hem bardak hem tasarım seçiniz.'); } }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                width: '100%', padding: '16px 24px',
                background: '#25D366', color: '#fff',
                border: 'none', borderRadius: 12,
                fontSize: 16, fontWeight: 800,
                cursor: 'pointer', textDecoration: 'none',
                letterSpacing: '0.01em',
              }}
            >
              <WaIcon />
              {selectedDesign?.id === '__custom__' ? '📱 Kendi Tasarımım İçin WhatsApp\'a Yaz' : '📱 WhatsApp\'tan Sipariş Ver'}
            </a>
          </div>
        </section>

        {/* ── Özel tasarım bilgi satırı ──────────────────────── */}
        <div style={{
          background: '#fff', border: '1px solid #E5E7EB', borderRadius: 12,
          padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        }}>
          <p style={{ fontSize: 14, color: '#6B7280', flex: 1, minWidth: 220 }}>
            💡 <strong style={{ color: '#1A1A1A' }}>Kendi fotoğrafını veya logonu bastırmak ister misin?</strong>{' '}
            WhatsApp&apos;tan bize ulaş, sana özel çözüm üretelim.
          </p>
          <a
            href={`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent('Merhaba, özel tasarım bastırmak istiyorum.')}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 18px', background: '#25D366', color: '#fff',
              borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            <WaIcon size={16} />
            WhatsApp&apos;a Yaz
          </a>
        </div>

      </main>

      {/* ── Toast ────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%',
          transform: 'translateX(-50%)',
          background: '#1F2937', color: '#fff',
          fontSize: 14, fontWeight: 600,
          padding: '12px 22px', borderRadius: 100,
          whiteSpace: 'nowrap', zIndex: 1000,
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        }}>
          {toast}
        </div>
      )}
    </>
  );
}

/* ─── YARDIMCI COMPONENT'LER ─────────────────────────────────── */

function SectionTitle({ number, title }: { number: number; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%',
        background: '#FF6B35', color: '#fff',
        fontSize: 14, fontWeight: 800,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>{number}</div>
      <h2 style={{ fontSize: '1.15rem', fontWeight: 700, letterSpacing: '-0.01em' }}>{title}</h2>
    </div>
  );
}

function CupCard({ cup, selected, expanded, onClick }: {
  cup: Cup;
  selected: boolean;
  expanded: boolean;
  onClick: () => void;
}) {
  const colors = cup.colors?.filter(c => c.images[0]) ?? [];
  const hasVariants = colors.length > 0;

  return (
    <CarouselCard selected={selected || expanded} onClick={onClick}>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1', borderRadius: 8, overflow: 'hidden', background: cup.imagePublicId ? '#f3f4f6' : (cup.gradient ?? '#f3f4f6'), marginBottom: 8 }}>
        {cup.imagePublicId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cfImg(cup.imagePublicId, 300)} alt={cup.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>☕</div>
        )}
        {/* Varyant göstergesi */}
        {hasVariants && (
          <div style={{
            position: 'absolute', bottom: 6, right: 6,
            background: expanded ? '#FF6B35' : 'rgba(0,0,0,0.5)',
            color: '#fff', fontSize: 9, fontWeight: 700,
            borderRadius: 4, padding: '2px 5px',
            transition: 'background 0.15s',
          }}>
            {colors.length} renk
          </div>
        )}
      </div>
      <div style={itemNameStyle}>{cup.name}</div>
      <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', color: '#FF6B35', marginTop: 2 }}>{cup.price}₺</div>
    </CarouselCard>
  );
}

function CarouselCard({ children, selected, onClick, highlight }: {
  children: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  highlight?: boolean;
}) {
  const borderColor = selected ? '#FF6B35' : highlight ? '#C9A84C' : '#E5E7EB';
  const bgColor     = selected ? '#FFF1EC' : highlight ? '#FFFBEB' : '#fff';
  return (
    <div
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: CARD_W,
        scrollSnapAlign: 'start',
        background: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: 12,
        padding: 10,
        cursor: 'pointer',
        position: 'relative',
        transform: selected ? 'translateY(-4px)' : undefined,
        boxShadow: selected ? '0 8px 24px rgba(0,0,0,0.13)' : '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={(e) => { if (!selected) { const el = e.currentTarget as HTMLDivElement; el.style.transform = 'translateY(-4px)'; el.style.boxShadow = '0 8px 24px rgba(0,0,0,0.13)'; } }}
      onMouseLeave={(e) => { if (!selected) { const el = e.currentTarget as HTMLDivElement; el.style.transform = ''; el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; } }}
    >
      {selected && (
        <div style={{
          position: 'absolute', top: 7, right: 7,
          width: 20, height: 20, borderRadius: '50%',
          background: '#FF6B35', color: '#fff',
          fontSize: 11, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2,
        }}>✓</div>
      )}
      {children}
    </div>
  );
}

function Visual({ imagePublicId, background, color, label, emoji }: {
  imagePublicId?: string; background: string; color: string; label: string; emoji: string;
}) {
  return (
    <div style={{
      width: '100%', aspectRatio: '1 / 1',
      borderRadius: 8,
      background: imagePublicId ? '#f3f4f6' : background,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: '1.1rem', color,
      marginBottom: 8, overflow: 'hidden', position: 'relative',
    }}>
      {imagePublicId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cfImg(imagePublicId, 300)} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      ) : (
        <><span>{label}</span><span style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: 2 }}>{emoji}</span></>
      )}
    </div>
  );
}

function Chip({ children, green }: { children: React.ReactNode; green?: boolean }) {
  return (
    <span style={{
      fontSize: 12, borderRadius: 100, padding: '4px 12px', fontWeight: 600,
      background: green ? '#DCFCE7' : '#FFF1EC',
      color: green ? '#166534' : '#E85A25',
    }}>{children}</span>
  );
}

function WaIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

const itemNameStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textAlign: 'center',
  color: '#1A1A1A',
  lineHeight: 1.3,
};
