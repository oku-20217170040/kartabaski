'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';

const WA_ICON = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const STATS = [
  { value: '500+', label: 'Ürün' },
  { value: 'Aynı Gün', label: 'Teslimat' },
  { value: '10+ Yıl', label: 'Deneyim' },
  { value: '7/24', label: 'Destek' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: 'easeOut' as const },
  }),
};

export default function HeroSection() {
  return (
    <section className="hero-section">
      {/* Grid background */}
      <div className="hero-grid" aria-hidden />

      {/* Glow orbs */}
      <div className="hero-orb hero-orb-1" aria-hidden />
      <div className="hero-orb hero-orb-2" aria-hidden />

      <div className="container hero-inner">
        {/* Eyebrow badge */}
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={0}
        >
          <span className="hero-eyebrow">
            <span className="hero-eyebrow-dot" />
            Esenyurt&apos;un En Yakın Spotçusu
          </span>
        </motion.div>

        {/* Title */}
        <motion.h1
          className="hero-title"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={1}
        >
          İkinci El & Sıfır Spot{' '}
          <span className="hero-title-accent">Ürünler</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          className="hero-subtitle"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={2}
        >
          Mobilya, beyaz eşya ve daha fazlasında{' '}
          <strong style={{ color: 'var(--text)', fontWeight: 600 }}>güvenilir</strong> alım satım.
          <br className="hidden sm:block" />
          Aynı gün teslimat · Nakliye desteği · WhatsApp sipariş
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          className="hero-ctas"
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          custom={3}
        >
          <motion.a
            href="https://wa.me/905426447296?text=Merhaba%2C%20ürünleriniz%20hakkında%20bilgi%20almak%20istiyorum"
            target="_blank"
            rel="noopener noreferrer"
            className="hero-cta-primary"
            whileHover={{ scale: 1.04, boxShadow: '0 8px 40px rgba(37,211,102,0.45)' }}
            whileTap={{ scale: 0.97 }}
          >
            {WA_ICON}
            WhatsApp ile İletişim
          </motion.a>

          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link href="/kategoriler" className="hero-cta-secondary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="7" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
                <rect x="14" y="14" width="7" height="7" rx="1" />
              </svg>
              Kategorilere Göz At
            </Link>
          </motion.div>

          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link href="/urun-sat" className="hero-cta-sell">
              🏷️ Eşyanı Sat
            </Link>
          </motion.div>
        </motion.div>

        {/* Stats */}
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
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.08, duration: 0.5 }}
            >
              <span className="hero-stat-value">{s.value}</span>
              <span className="hero-stat-label">{s.label}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>

      <style>{`
        .hero-section {
          position: relative;
          overflow: hidden;
          padding: 120px 0 80px;
          background: var(--bg);
        }

        /* Grid */
        .hero-grid {
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(37,211,102,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(37,211,102,0.04) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: radial-gradient(ellipse 80% 60% at 50% 0%, #000 60%, transparent 100%);
          pointer-events: none;
        }

        /* Glow orbs */
        .hero-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(100px);
          pointer-events: none;
          animation: orb-pulse 6s ease-in-out infinite;
        }
        .hero-orb-1 {
          width: 500px; height: 500px;
          background: rgba(37,211,102,0.08);
          top: -200px; left: -100px;
          animation-delay: 0s;
        }
        .hero-orb-2 {
          width: 400px; height: 400px;
          background: rgba(47,129,247,0.06);
          top: -100px; right: -80px;
          animation-delay: 3s;
        }
        @keyframes orb-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }

        .hero-inner {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 0;
        }

        /* Eyebrow */
        .hero-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 16px;
          border-radius: 100px;
          border: 1px solid rgba(37,211,102,0.25);
          background: rgba(37,211,102,0.06);
          color: var(--accent);
          font-size: 13px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          margin-bottom: 24px;
        }
        .hero-eyebrow-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--accent);
          box-shadow: 0 0 8px rgba(37,211,102,0.8);
          animation: dot-blink 2s ease-in-out infinite;
        }
        @keyframes dot-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        /* Title */
        .hero-title {
          font-size: clamp(38px, 6vw, 72px);
          font-weight: 800;
          line-height: 1.1;
          letter-spacing: -0.03em;
          color: var(--text);
          margin: 0 0 20px;
          max-width: 800px;
        }
        .hero-title-accent {
          background: linear-gradient(135deg, #25D366 0%, #16a34a 50%, #4ade80 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          position: relative;
        }
        .hero-title-accent::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0; right: 0;
          height: 3px;
          background: linear-gradient(135deg, #25D366, #16a34a);
          border-radius: 2px;
          opacity: 0.5;
        }

        /* Subtitle */
        .hero-subtitle {
          font-size: clamp(15px, 2vw, 18px);
          color: var(--muted);
          line-height: 1.7;
          max-width: 560px;
          margin: 0 0 36px;
        }

        /* CTAs */
        .hero-ctas {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          justify-content: center;
          margin-bottom: 52px;
        }
        .hero-cta-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 13px 24px;
          border-radius: 12px;
          background: linear-gradient(135deg, #25D366, #16a34a);
          color: #fff;
          font-weight: 700;
          font-size: 15px;
          text-decoration: none;
          box-shadow: 0 4px 24px rgba(37,211,102,0.35);
          transition: box-shadow 0.2s;
        }
        .hero-cta-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 13px 24px;
          border-radius: 12px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.12);
          color: var(--text);
          font-weight: 600;
          font-size: 15px;
          text-decoration: none;
          transition: background 0.2s, border-color 0.2s;
        }
        .hero-cta-secondary:hover {
          background: rgba(255,255,255,0.09);
          border-color: rgba(255,255,255,0.2);
        }
        .hero-cta-sell {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 13px 24px;
          border-radius: 12px;
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.25);
          color: #f59e0b;
          font-weight: 600;
          font-size: 15px;
          text-decoration: none;
          transition: background 0.2s;
        }
        .hero-cta-sell:hover {
          background: rgba(245,158,11,0.16);
        }

        /* Stats */
        .hero-stats {
          display: flex;
          gap: 0;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          background: rgba(16,24,36,0.6);
          backdrop-filter: blur(12px);
          overflow: hidden;
        }
        .hero-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 18px 32px;
          gap: 4px;
          position: relative;
        }
        .hero-stat:not(:last-child)::after {
          content: '';
          position: absolute;
          right: 0;
          top: 20%;
          bottom: 20%;
          width: 1px;
          background: rgba(255,255,255,0.08);
        }
        .hero-stat-value {
          font-size: 22px;
          font-weight: 800;
          color: var(--accent);
          line-height: 1;
        }
        .hero-stat-label {
          font-size: 11px;
          color: var(--muted);
          font-weight: 500;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        @media (max-width: 640px) {
          .hero-section { padding: 100px 0 60px; }
          .hero-stats { flex-wrap: wrap; }
          .hero-stat { padding: 14px 20px; flex: 1 1 50%; }
          .hero-stat:nth-child(2)::after { display: none; }
        }
      `}</style>
    </section>
  );
}
