'use client';

import Link from 'next/link';
import { Caveat } from 'next/font/google';
import { useEffect, useMemo, useRef, useState } from 'react';
import { WhatsAppIcon, CheckIcon } from '@/components/icons';
import { WHATSAPP_BASE } from '@/lib/constants';

const handwriting = Caveat({ subsets: ['latin', 'latin-ext'], weight: ['600'], display: 'swap' });

/** Real handle colours offered on the Lüks Kupa. `soft` tints the backdrop disc. */
const HANDLES = [
  { name: 'Sarı', value: '#F2C94C', soft: '#FBF0CC' },
  { name: 'Koyu yeşil', value: '#1F4A36', soft: '#DCE8E0' },
  { name: 'Mavi', value: '#3D6FB6', soft: '#DCE6F5' },
  { name: 'Pembe', value: '#E79AB0', soft: '#F9E3EA' },
  { name: 'Turuncu', value: '#E8833A', soft: '#FBE4D3' },
  { name: 'Siyah', value: '#1B1A17', soft: '#E7E3DC' },
] as const;

const STYLES = [
  { id: 'modern', label: 'Modern' },
  { id: 'hand', label: 'El yazısı' },
] as const;
type StyleId = (typeof STYLES)[number]['id'];

const SAMPLES = [
  'Dünyanın en iyi annesi',
  'Pazartesi kahvesi',
  'İyi ki doğdun Elif',
  'Ekip 2026',
  'Önce kahve',
];

const MAX_LEN = 40;

/** Splits text into at most 3 balanced lines for the mug face. */
function toLines(text: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const target = text.length <= 14 ? 1 : text.length <= 28 ? 2 : 3;
  const per = Math.ceil(text.length / target);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > per && lines.length < target - 1) {
      lines.push(cur);
      cur = w;
    } else {
      cur = cur ? `${cur} ${w}` : w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/** Auto-types sample phrases while the visitor hasn't typed anything. */
function useTypewriter(active: boolean) {
  const [text, setText] = useState('');
  useEffect(() => {
    if (!active) return;
    let sample = 0;
    let i = 0;
    let deleting = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const full = SAMPLES[sample];
      if (!deleting) {
        i += 1;
        setText(full.slice(0, i));
        if (i === full.length) { deleting = true; timer = setTimeout(tick, 1800); return; }
        timer = setTimeout(tick, 70);
      } else {
        i -= 1;
        setText(full.slice(0, i));
        if (i === 0) { deleting = false; sample = (sample + 1) % SAMPLES.length; timer = setTimeout(tick, 350); return; }
        timer = setTimeout(tick, 32);
      }
    };
    timer = setTimeout(tick, 600);
    return () => clearTimeout(timer);
  }, [active]);
  return text;
}

interface Props {
  lowestPrice?: number | null;
}

export default function HeroSection({ lowestPrice }: Props) {
  const [typed, setTyped] = useState('');
  const [handle, setHandle] = useState(0);
  const [style, setStyle] = useState<StyleId>('modern');
  // Hareket tercihi yalnızca tarayıcıda bilinir; ilk çizim sunucuyla aynı olsun diye mount sonrası okunur.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [prefersReduced, setPrefersReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
    const onChange = () => setPrefersReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  const animate = mounted && !prefersReduced;
  const reduceMotion = !animate;
  const auto = useTypewriter(typed.length === 0 && animate);

  const shown = typed || (animate ? auto : SAMPLES[0]);
  const lines = useMemo(() => toLines(shown), [shown]);
  const longest = Math.max(1, ...lines.map((l) => l.length));
  const fontSize = Math.max(18, Math.min(style === 'hand' ? 52 : 38, (style === 'hand' ? 380 : 270) / longest));
  const lineGap = fontSize * 1.12;
  const textTop = 215 - ((lines.length - 1) * lineGap) / 2;

  // Pointer-driven tilt
  const stageRef = useRef<HTMLDivElement>(null);
  const mugRef = useRef<HTMLDivElement>(null);
  const setTilt = (x: number, y: number) => {
    mugRef.current?.style.setProperty('--tilt-x', `${x}deg`);
    mugRef.current?.style.setProperty('--tilt-y', `${y}deg`);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (reduceMotion || e.pointerType !== 'mouse') return;
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return;
    setTilt(-((e.clientY - r.top) / r.height - 0.5) * 10, ((e.clientX - r.left) / r.width - 0.5) * 16);
  };
  const onPointerLeave = () => setTilt(0, 0);

  const current = HANDLES[handle];
  const orderText = typed.trim()
    ? `Merhaba, kupaya şu yazıyı bastırmak istiyorum: "${typed.trim()}". Kulp rengi: ${current.name}. Yazı stili: ${STYLES.find((s) => s.id === style)?.label}.`
    : 'Merhaba, kişiye özel kupa siparişi vermek istiyorum.';
  const waHref = `${WHATSAPP_BASE}?text=${encodeURIComponent(orderText)}`;

  return (
    <section className="hero2" aria-labelledby="hero-title" style={{ ['--handle-soft' as string]: current.soft }}>
      <div className="wrap hero2-grid">
        <div className="hero2-copy">
          <h1 id="hero-title" className="hero2-title">
            Kupanıza <span className="hero2-mark">ne yazalım?</span>
          </h1>
          <p className="hero2-lead">
            Bir isim, bir tarih, şirket logonuz ya da tek satırlık bir espri. Yazın, kulp rengini seçin;
            baskıdan önce önizlemesini size gönderelim.
          </p>
        </div>

        <div
          ref={stageRef}
          className="hero2-stage"
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        >
          <div className="hero2-disc" aria-hidden="true" />
          <div ref={mugRef} className="hero2-mug">
            <svg viewBox="0 0 420 400" role="img" aria-label={shown ? `Önizleme: kupanın üzerinde "${shown}" yazıyor` : 'Boş kupa önizlemesi'}>
              <defs>
                <clipPath id="mugFace">
                  <path d="M92 104 H288 L280 330 Q278 352 254 352 H126 Q102 352 100 330 Z" />
                </clipPath>
              </defs>

              <g className="hero2-steam" aria-hidden="true">
                <path d="M160 70 C150 52 172 42 162 22" />
                <path d="M190 74 C180 54 204 44 192 18" />
                <path d="M220 70 C210 52 232 42 222 24" />
              </g>

              <ellipse cx="190" cy="372" rx="118" ry="12" fill="#1B1A17" opacity="0.08" />

              <path
                className="hero2-handle"
                d="M282 150 C352 146 362 186 360 220 C358 262 330 290 278 288"
                stroke={current.value}
                strokeWidth="26"
                strokeLinecap="round"
                fill="none"
              />

              <path d="M92 104 H288 L280 330 Q278 352 254 352 H126 Q102 352 100 330 Z" fill="#FFFFFF" />
              <path d="M262 104 H288 L280 330 Q278 352 254 352 H246 Q262 340 262 318 Z" fill="#EFEBE4" />
              <path d="M92 104 H288 L280 330 Q278 352 254 352 H126 Q102 352 100 330 Z" fill="none" stroke="#E2DCD1" strokeWidth="1.5" />
              <ellipse cx="190" cy="104" rx="98" ry="17" fill="#F6F3EE" stroke="#E2DCD1" strokeWidth="1.5" />
              <ellipse cx="190" cy="106" rx="86" ry="12" fill="#6E4B33" />
              <ellipse cx="176" cy="104" rx="30" ry="3.5" fill="#8A6247" opacity="0.6" />

              <g clipPath="url(#mugFace)">
                <text
                  x="190"
                  textAnchor="middle"
                  className={style === 'hand' ? handwriting.className : 'hero2-print-modern'}
                  fontSize={fontSize}
                  fill="#1B1A17"
                >
                  {lines.map((l, i) => (
                    <tspan key={`${i}-${l}`} x="190" y={textTop + i * lineGap} dominantBaseline="middle">
                      {l}
                    </tspan>
                  ))}
                </text>
                {typed.length === 0 && animate && (
                  <rect className="hero2-caret" x={190 + (lines[lines.length - 1]?.length ?? 0) * fontSize * 0.27} y={textTop + (lines.length - 1) * lineGap - fontSize * 0.45} width="2" height={fontSize * 0.9} fill={current.value === '#1B1A17' ? '#55524B' : current.value} />
                )}
              </g>
            </svg>
          </div>
        </div>

        <div className="hero2-controls">
          <label className="hero2-input">
            <span className="sr-only">Kupaya yazılacak metin</span>
            <input
              type="text"
              value={typed}
              maxLength={MAX_LEN}
              placeholder="Kupaya ne yazalım?"
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              enterKeyHint="done"
            />
            <span className="hero2-count" aria-hidden="true">{typed.length}/{MAX_LEN}</span>
          </label>

          <div className="hero2-options">
            <div role="radiogroup" aria-label="Kulp rengi" className="hero2-swatches">
              {HANDLES.map((h, i) => (
                <button
                  key={h.name}
                  type="button"
                  role="radio"
                  aria-checked={handle === i}
                  aria-label={h.name}
                  title={h.name}
                  className="hero2-swatch"
                  style={{ background: h.value }}
                  onClick={() => setHandle(i)}
                />
              ))}
            </div>
            <div role="radiogroup" aria-label="Yazı stili" className="hero2-styles">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={style === s.id}
                  className={`hero2-style ${s.id === 'hand' ? handwriting.className : ''}`}
                  onClick={() => setStyle(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="hero2-ctas">
            <a className="btn btn-primary" href={waHref} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon /> {typed.trim() ? 'Bu tasarımla sipariş verin' : "WhatsApp'tan sipariş verin"}
            </a>
            <Link className="btn btn-outline" href="#urunler">Ürünlere göz atın</Link>
          </div>

          <ul className="hero2-facts">
            <li><CheckIcon size={16} /> Tek adet de basılır</li>
            <li><CheckIcon size={16} /> Baskı öncesi ücretsiz önizleme</li>
            <li><CheckIcon size={16} /> 3 iş gününde kargoda{lowestPrice ? ` · ${lowestPrice.toLocaleString('tr-TR')}₺'den` : ''}</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
