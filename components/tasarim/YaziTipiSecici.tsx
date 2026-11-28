'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CATEGORY_LABELS, FEATURED, FONTS, FontCategory, FontInfo, fontInfo, fontSpec, loadFont, searchFonts,
} from '@/lib/tasarim/yazi-tipleri';
import Pencere from './Pencere';
import { useInView } from './use-in-view';

const RECENT_KEY = 'kartabaski-yazitipleri';
const PAGE = 40;

type Tab = 'one-cikan' | 'son' | 'hepsi' | FontCategory;

function readRecent(): string[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Satır görününce tipini indirir ve müşterinin yazısını o tipte gösterir. */
function FontRow({ font, sample, selected, onPick }: { font: FontInfo; sample: string; selected: boolean; onPick: () => void }) {
  const [ref, seen] = useInView<HTMLButtonElement>();
  const [state, setState] = useState<'bekliyor' | 'hazir' | 'hata'>('bekliyor');

  useEffect(() => {
    if (!seen) return;
    let alive = true;
    loadFont(font.id).then(() => { if (alive) setState('hazir'); }).catch(() => { if (alive) setState('hata'); });
    return () => { alive = false; };
  }, [seen, font.id]);

  const spec = fontSpec(font.id);
  return (
    <button ref={ref} type="button" className="tsf-row" aria-pressed={selected} onClick={onPick}>
      <span className="tsf-sample" style={state === 'hazir' ? { fontFamily: spec.family, fontWeight: spec.weight } : { opacity: 0.35 }}>
        {sample}
      </span>
      <span className="tsf-name">{font.ad}{state === 'hata' ? ' · yüklenemedi' : ''}</span>
    </button>
  );
}

interface Props {
  value: string;
  /** Örnek olarak gösterilecek yazı. */
  text: string;
  onPick: (id: string) => void;
  onClose: () => void;
}

export default function YaziTipiSecici({ value, text, onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('one-cikan');
  const [count, setCount] = useState(PAGE);
  const [recent] = useState(readRecent);
  const [more, seenMore] = useInView<HTMLButtonElement>(false);
  const top = useRef<HTMLDivElement>(null);
  const sample = text.replace(/\s+/g, ' ').trim().slice(0, 28) || 'İyi ki doğdun Ayşe';

  const list = useMemo(() => {
    if (query.trim()) return searchFonts(query, tab.length === 1 ? (tab as FontCategory) : undefined);
    if (tab === 'one-cikan') return FEATURED;
    if (tab === 'son') return recent.map(fontInfo);
    if (tab === 'hepsi') return FONTS;
    return searchFonts('', tab);
  }, [query, tab, recent]);

  useEffect(() => {
    setCount(PAGE);
    top.current?.scrollIntoView({ block: 'nearest' });
  }, [query, tab]);
  useEffect(() => { if (seenMore) setCount((c) => c + PAGE); }, [seenMore]);

  const pick = (id: string) => {
    try { window.localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recent.filter((x) => x !== id)].slice(0, 12))); } catch { /* depolama kapalı */ }
    onPick(id);
  };

  const surprise = () => {
    const pool = list.length > 1 ? list : FONTS;
    pick(pool[Math.floor(Math.random() * pool.length)].id);
  };

  const tabs: [Tab, string][] = [
    ['one-cikan', 'Öne çıkanlar'],
    ...(recent.length ? [['son', 'Kullandıklarınız'] as [Tab, string]] : []),
    ...(Object.entries(CATEGORY_LABELS) as [FontCategory, string][]),
    ['hepsi', 'Hepsi'],
  ];

  return (
    <Pencere
      title="Yazı tipi seçin"
      onClose={onClose}
      tools={(
        <>
          <div className="tsp-search">
            <input
              type="search" className="cart-input" value={query} autoComplete="off"
              aria-label="Yazı tipi adıyla arayın" placeholder={`${FONTS.length} yazı tipi içinde arayın`}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="button" className="tsr-chip" onClick={surprise}>Rastgele</button>
          </div>
          <div className="tsp-tabs" role="group" aria-label="Yazı tipi grubu">
            {tabs.map(([id, label]) => (
              <button key={id} type="button" className="tsr-chip" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>
            ))}
          </div>
        </>
      )}
    >
      <div ref={top} />
      <p className="tsr-small" role="status">{list.length} yazı tipi</p>
      <div className="tsf-list">
        {list.slice(0, count).map((f) => (
          <FontRow key={f.id} font={f} sample={sample} selected={f.id === value} onPick={() => pick(f.id)} />
        ))}
      </div>
      {count < list.length && (
        <button ref={more} type="button" className="btn btn-outline btn-block" onClick={() => setCount(count + PAGE)}>Daha fazla göster</button>
      )}
      {!list.length && <p>Bu adla bir yazı tipi yok.</p>}
    </Pencere>
  );
}
