'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CATEGORY_LABELS, FEATURED, FONTS, FontCategory, FontInfo, fontInfo, fontSpec, loadFont, searchFonts,
} from '@/lib/tasarim/yazi-tipleri';
import { IShuffle } from '../ikonlar';
import { useInView } from '../use-in-view';

const RECENT_KEY = 'kartabaski-yazitipleri';
const PAGE = 40;

type Group = 'one-cikan' | 'son' | 'hepsi' | FontCategory;

function readRecent(): string[] {
  try {
    const list = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Kutu görününce tipini indirir ve müşterinin yazısını o tipte gösterir. */
function FontTile({ font, sample, selected, onPick }: { font: FontInfo; sample: string; selected: boolean; onPick: () => void }) {
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
    <button ref={ref} type="button" className="std-font" aria-pressed={selected} aria-label={font.ad} title={font.ad} onClick={onPick}>
      <span className="std-font-sample" style={state === 'hazir' ? { fontFamily: spec.family, fontWeight: spec.weight } : { opacity: 0.3 }}>
        {sample}
      </span>
      <span className="std-font-name">{state === 'hata' ? 'Yüklenemedi' : font.ad}</span>
    </button>
  );
}

interface Props {
  value: string;
  /** Örnek olarak gösterilecek yazı. */
  text: string;
  onPick: (id: string) => void;
}

export default function YaziTipiPaneli({ value, text, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<Group>('one-cikan');
  const [count, setCount] = useState(PAGE);
  const [recent, setRecent] = useState(readRecent);
  const [more, seenMore] = useInView<HTMLButtonElement>(false);
  const top = useRef<HTMLDivElement>(null);
  const sample = text.replace(/\s+/g, ' ').trim().slice(0, 16) || 'Ağaç Şiir';

  const list = useMemo(() => {
    if (query.trim()) return searchFonts(query, group.length === 1 ? (group as FontCategory) : undefined);
    if (group === 'one-cikan') return FEATURED;
    if (group === 'son') return recent.map(fontInfo);
    if (group === 'hepsi') return FONTS;
    return searchFonts('', group);
  }, [query, group, recent]);

  useEffect(() => {
    setCount(PAGE);
    top.current?.scrollIntoView({ block: 'nearest' });
  }, [query, group]);
  useEffect(() => { if (seenMore) setCount((c) => c + PAGE); }, [seenMore]);

  const pick = (id: string) => {
    const next = [id, ...recent.filter((x) => x !== id)].slice(0, 12);
    setRecent(next);
    try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* depolama kapalı */ }
    onPick(id);
  };

  const surprise = () => {
    const pool = list.length > 1 ? list : FONTS;
    pick(pool[Math.floor(Math.random() * pool.length)].id);
  };

  const groups: [Group, string][] = [
    ['one-cikan', 'Seçmeler'],
    ...(recent.length ? [['son', 'Son kullanılan'] as [Group, string]] : []),
    ...(Object.entries(CATEGORY_LABELS) as [FontCategory, string][]),
    ['hepsi', 'Hepsi'],
  ];

  return (
    <>
      <div className="std-sticky">
        <div className="std-search">
          <input
            type="search" className="std-input" value={query} autoComplete="off"
            aria-label="Yazı tipi adıyla arayın" placeholder={`${FONTS.length} yazı tipinde ara`}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="std-icon-btn is-boxed" onClick={surprise} aria-label="Rastgele bir yazı tipi" title="Rastgele"><IShuffle /></button>
        </div>
        <div className="std-chips" role="group" aria-label="Yazı tipi grubu">
          {groups.map(([id, label]) => (
            <button key={id} type="button" className="std-chip" aria-pressed={group === id} onClick={() => setGroup(id)}>{label}</button>
          ))}
        </div>
      </div>
      <div ref={top} />
      <div className="std-fonts">
        {list.slice(0, count).map((f) => (
          <FontTile key={f.id} font={f} sample={sample} selected={f.id === value} onPick={() => pick(f.id)} />
        ))}
      </div>
      {count < list.length && (
        <button ref={more} type="button" className="std-more" onClick={() => setCount(count + PAGE)}>Daha fazla</button>
      )}
      {!list.length && <p className="std-empty">Bu adla bir yazı tipi yok.</p>}
    </>
  );
}
