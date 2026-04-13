'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { WHATSAPP_BASE, DEFAULT_WA_TEXT } from '@/lib/constants';

const WA_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const STAR_ICON = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
  </svg>
);

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.55, ease: 'easeOut' as const },
  }),
};

const STATS = [
  { value: '500+',      label: 'Sipariş'      },
  { value: 'Ücretsiz', label: 'Tasarım'       },
  { value: '3 Gün',    label: 'Teslimat'      },
  { value: 'TR',       label: 'Geneli Kargo'  },
];

const WA_HREF = `${WHATSAPP_BASE}?text=${encodeURIComponent(DEFAULT_WA_TEXT)}`;

export default function HeroSection() {
  return (
    <section className="hero-section">
      <div className="hero-grid" aria-hidden />
      <div className="hero-orb hero-orb-1" aria-hidden />
      <div className="hero-orb hero-orb-2" aria-hidden />

      <div className="container hero-inner">

        {/* Sol — metin içeriği */}
        <div className="hero-content">
          <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
            <span className="hero-eyebrow">
              <span className="hero-eyebrow-dot" />
              Hayal Et, Biz Basalım
            </span>
          </motion.div>

          <motion.h1
            className="hero-title"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={1}
          >
            Kişiye Özel{' '}
            <span className="hero-title-accent">Kupa Baskı</span>
            {' '}ile Markanı Yaşat
          </motion.h1>

          <motion.p
            className="hero-subtitle"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={2}
          >
            Bireysel ve kurumsal siparişler · Ücretsiz tasarım desteği ·
            Türkiye&apos;nin her yerine hızlı kargo.
          </motion.p>

          <motion.div
            className="hero-ctas"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={3}
          >
            <motion.a
              href={WA_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className="hero-cta-primary"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              {WA_ICON}
              WhatsApp&apos;tan Sipariş Ver
            </motion.a>

            <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}>
              <Link href="/nasil-siparis-verilir" className="hero-cta-secondary">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/>
                </svg>
                Nasıl Çalışır?
              </Link>
            </motion.div>
          </motion.div>

          {/* İstatistikler */}
          <motion.div
            className="hero-stats"
            variants={fadeUp}
            initial="hidden"
            animate="visible"
            custom={4}
          >
            {STATS.map((s, i) => (
              <motion.div
                key={s.label}
                className="hero-stat"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 + i * 0.07, duration: 0.4 }}
              >
                <span className="hero-stat-value">{s.value}</span>
                <span className="hero-stat-label">{s.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Sağ — görsel / dekoratif kutu */}
        <motion.div
          className="hero-visual"
          initial={{ opacity: 0, x: 32 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut', delay: 0.15 }}
        >
          {/* Ürün görseli yoksa dekoratif kutu göster */}
          <div className="hero-deco-box">
            <div className="hero-deco-inner">
              <span className="hero-deco-icon">☕</span>
              <span className="hero-deco-label">Kişiye Özel<br />Kupa Baskı</span>

              {/* Floating chip'ler */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
                {['Sihirli Mat', 'Sihirli Konik', 'Renkli Kupa'].map((tag) => (
                  <span key={tag} style={{
                    padding: '5px 12px',
                    borderRadius: '100px',
                    background: 'rgba(0,109,47,0.1)',
                    color: 'var(--primary)',
                    fontSize: 12,
                    fontWeight: 600,
                    border: '1px solid rgba(0,109,47,0.2)',
                  }}>{tag}</span>
                ))}
              </div>
            </div>
          </div>

          {/* Floating değerlendirme kartı */}
          <motion.div
            className="hero-float-card"
            initial={{ opacity: 0, y: 16, x: -8 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
          >
            <div className="hero-float-stars">
              {[...Array(5)].map((_, i) => (
                <span key={i} style={{ color: '#755B00' }}>{STAR_ICON}</span>
              ))}
            </div>
            <p className="hero-float-text">
              &ldquo;Kupalar muhteşem geldi, tasarım tam istediğimiz gibi!&rdquo;
            </p>
            <span className="hero-float-sub">— Müşteri Yorumu</span>
          </motion.div>
        </motion.div>

      </div>
    </section>
  );
}
