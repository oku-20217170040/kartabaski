'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ShapeSet } from '@/lib/tasarim/model';
import { GROUP_LABELS, ShapeList, loadShapeList, searchShapes, shapeUrl } from '@/lib/tasarim/susler';
import { useInView } from '../use-in-view';

const PAGE = 60;

/** Grup düğmelerindeki simge: grubu anlatan bir süs. */
const GROUP_ICONS: Record<string, string> = {
  'Smileys & Emotion': 'smiling-face-with-hearts', 'People & Body': 'waving-hand', 'Animals & Nature': 'cat-face',
  'Food & Drink': 'birthday-cake', Activities: 'party-popper', 'Travel & Places': 'airplane', Objects: 'wrapped-gift',
  Symbols: 'sparkling-heart', Flags: 'chequered-flag',
};

export default function SusPaneli({ onPick }: { onPick: (set: ShapeSet, name: string) => void }) {
  const [list, setList] = useState<ShapeList | null>(null);
  const [failed, setFailed] = useState(false);
  const [set, setSet] = useState<ShapeSet>('fl');
  const [group, setGroup] = useState('');
  const [query, setQuery] = useState('');
  const [count, setCount] = useState(PAGE);
  const [more, seenMore] = useInView<HTMLButtonElement>(false);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => { loadShapeList().then(setList).catch(() => setFailed(true)); }, []);

  const names = useMemo(() => {
    if (!list) return [];
    const pool = set === 'ph' ? list.ph : group && !query ? list.fl[group] ?? [] : Array.from(new Set(Object.values(list.fl).flat()));
    return group && !query ? pool : searchShapes(pool, set, query);
  }, [list, set, group, query]);

  useEffect(() => {
    setCount(PAGE);
    top.current?.scrollIntoView({ block: 'nearest' });
  }, [set, group, query]);
  useEffect(() => { if (seenMore) setCount((c) => c + PAGE); }, [seenMore]);

  return (
    <>
      <div className="std-sticky">
        <input
          type="search" className="std-input" value={query} autoComplete="off" aria-label="Süs arayın"
          placeholder="Ara: kalp, kedi, futbol…" onChange={(e) => setQuery(e.target.value)}
        />
        <div className="std-segment" role="group" aria-label="Süs türü">
          <button type="button" aria-pressed={set === 'fl'} onClick={() => setSet('fl')}>Renkli</button>
          <button type="button" aria-pressed={set === 'ph'} onClick={() => { setSet('ph'); setGroup(''); }}>Boyanabilir</button>
        </div>
        {set === 'fl' && list && !query && (
          <div className="std-chips" role="group" aria-label="Süs grubu">
            <button type="button" className="std-chip is-art" aria-pressed={!group} aria-label="Öne çıkanlar" title="Öne çıkanlar" onClick={() => setGroup('')}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shapeUrl('fl', 'glowing-star')} alt="" width={28} height={28} />
            </button>
            {Object.keys(list.fl).map((g) => (
              <button key={g} type="button" className="std-chip is-art" aria-pressed={group === g} aria-label={GROUP_LABELS[g] ?? g} title={GROUP_LABELS[g] ?? g} onClick={() => setGroup(g)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={shapeUrl('fl', GROUP_ICONS[g] && list.fl[g].includes(GROUP_ICONS[g]) ? GROUP_ICONS[g] : list.fl[g][0])} alt="" width={28} height={28} />
              </button>
            ))}
          </div>
        )}
      </div>
      <div ref={top} />
      {failed && <p className="std-empty" role="alert">Süsler yüklenemedi. Sayfayı yenileyin.</p>}
      {!list && !failed && <p className="std-empty" role="status">Süsler yükleniyor…</p>}
      {list && !names.length && <p className="std-empty">Süs bulunamadı. Başka bir sözcük deneyin.</p>}
      <div className="std-stickers">
        {names.slice(0, count).map((name) => (
          <button key={name} type="button" onClick={() => onPick(set, name)} aria-label={name.replace(/-/g, ' ')} title={name.replace(/-/g, ' ')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shapeUrl(set, name)} alt="" width={44} height={44} loading="lazy" />
          </button>
        ))}
      </div>
      {count < names.length && (
        <button ref={more} type="button" className="std-more" onClick={() => setCount(count + PAGE)}>Daha fazla</button>
      )}
    </>
  );
}
