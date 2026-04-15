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

function buildWaUrl(cup: Cup, design: Design): string {
  const msg = `Merhaba, ${cup.code} bardağına ${design.code} tasarımını bastırmak istiyorum. Bilgi alabilir miyim?`;
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}

/* ─── COMPONENT ─────────────────────────────────────────────── */
export default function ConfiguratorClient() {
  const [cups,           setCups]           = useState<Cup[]>([]);
  const [designs,        setDesigns]        = useState<Design[]>([]);
  const [dataLoading,    setDataLoading]    = useState(true);
  const [selectedCup,    setSelectedCup]    = useState<Cup | null>(null);
  const [selectedDesign, setSelectedDesign] = useState<Design | null>(null);
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

  function handleSelectCup(cup: Cup) {
    setSelectedCup(cup);
    if (!selectedDesign) {
      setTimeout(() => designsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  }

  function handleSelectDesign(design: Design) {
    setSelectedDesign(design);
    if (selectedCup) {
      setTimeout(() => previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    }
  }

  const bothSelected = !!(selectedCup && selectedDesign);

  if (dataLoading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" />
    </div>
  );

  return (
    <>
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
            <div style={gridStyle} className="configurator-grid">
              {cups.map((cup) => (
                <ItemCard
                  key={cup.id}
                  selected={selectedCup?.id === cup.id}
                  onClick={() => handleSelectCup(cup)}
                >
                  <Visual imagePublicId={cup.imagePublicId} background={cup.gradient} color={cup.textColor} label={cup.code} emoji="☕" />
                  <div style={itemNameStyle}>{cup.name}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, textAlign: 'center', color: '#FF6B35', marginTop: 2 }}>{cup.price}₺</div>
                </ItemCard>
              ))}
            </div>
          )}
        </section>

        {/* ── 2. TASARIM SEÇİMİ ────────────────────────────── */}
        <section ref={designsRef}>
          <SectionTitle number={2} title="Tasarımını Seç" />
          {designs.length === 0 ? (
            <p style={{ color: '#6B7280', fontSize: 14 }}>Henüz tasarım eklenmemiş.</p>
          ) : (
            <div style={gridStyle} className="configurator-grid">
              {designs.map((design) => (
                <ItemCard
                  key={design.id}
                  selected={selectedDesign?.id === design.id}
                  onClick={() => handleSelectDesign(design)}
                >
                  <Visual imagePublicId={design.imagePublicId} background={design.gradient} color={design.textColor} label={design.code} emoji="🎨" />
                  <div style={itemNameStyle}>{design.name}</div>
                </ItemCard>
              ))}
            </div>
          )}
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
                    background: selectedCup.imagePublicId ? '#f3f4f6' : selectedCup.gradient,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '1.3rem',
                    color: selectedCup.textColor,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
                    overflow: 'hidden',
                  }}>
                    {selectedCup.imagePublicId ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cfImg(selectedCup.imagePublicId, 200)} alt={selectedCup.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <><span>{selectedCup.code}</span><span style={{ fontSize: '0.7rem', opacity: 0.8 }}>☕</span></>
                    )}
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280' }}>{selectedCup.name}</span>
                </div>
              )}

              <span style={{ fontSize: '2rem', color: '#FF6B35', fontWeight: 800 }}>+</span>

              {selectedDesign && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 100, height: 100, borderRadius: 12,
                    background: selectedDesign.imagePublicId ? '#f3f4f6' : selectedDesign.gradient,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '1.3rem', color: selectedDesign.textColor,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.13)',
                    overflow: 'hidden',
                  }}>
                    {selectedDesign.imagePublicId ? (
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
                  Seçimin: {selectedCup!.name} ({selectedCup!.code}) + {selectedDesign!.name} ({selectedDesign!.code})
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
              href={bothSelected ? buildWaUrl(selectedCup!, selectedDesign!) : '#'}
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
              📱 WhatsApp&apos;tan Sipariş Ver
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

function ItemCard({ children, selected, onClick }: { children: React.ReactNode; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: selected ? '#FFF1EC' : '#fff',
        border: `2px solid ${selected ? '#FF6B35' : '#E5E7EB'}`,
        borderRadius: 12,
        padding: 10,
        cursor: 'pointer',
        position: 'relative',
        transform: selected ? 'translateY(-4px)' : undefined,
        boxShadow: selected ? '0 8px 24px rgba(0,0,0,0.13)' : '0 2px 8px rgba(0,0,0,0.08)',
        transition: 'transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease',
        userSelect: 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={(e) => { if (!selected) { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(0,0,0,0.13)'; } }}
      onMouseLeave={(e) => { if (!selected) { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; } }}
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

function Visual({ imagePublicId, background, color, label, emoji }: { imagePublicId?: string; background: string; color: string; label: string; emoji: string }) {
  return (
    <div style={{
      width: '100%', aspectRatio: '1 / 1',
      borderRadius: 8,
      background: imagePublicId ? '#f3f4f6' : background,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: '1.1rem', color,
      marginBottom: 8,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {imagePublicId ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cfImg(imagePublicId, 300)}
          alt={label}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <>
          <span>{label}</span>
          <span style={{ fontSize: '0.65rem', opacity: 0.8, marginTop: 2 }}>{emoji}</span>
        </>
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

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(5, 1fr)',
  gap: 12,
};

// Kullanım: <div style={gridStyle} className="configurator-grid">

const itemNameStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  textAlign: 'center',
  color: '#1A1A1A',
  lineHeight: 1.3,
};
