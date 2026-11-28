'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ShapeSet } from '@/lib/tasarim/model';
import { GROUP_LABELS, ShapeList, loadShapeList, searchShapes, shapeUrl } from '@/lib/tasarim/susler';
import Pencere from './Pencere';
import { useInView } from './use-in-view';

const PAGE = 80;

interface Props {
  title?: string;
  onPick: (set: ShapeSet, name: string) => void;
  onClose: () => void;
}

export default function SusSecici({ title = 'Süs seçin', onPick, onClose }: Props) {
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
    <Pencere
      title={title}
      onClose={onClose}
      tools={(
        <>
          <input
            type="search" className="cart-input" value={query} autoComplete="off" aria-label="Süs arayın"
            placeholder="Arayın: kalp, kedi, doğum günü, futbol…" onChange={(e) => setQuery(e.target.value)}
          />
          <div className="tsp-tabs" role="group" aria-label="Süs türü">
            <button type="button" className="tsr-chip" aria-pressed={set === 'fl'} onClick={() => setSet('fl')}>Renkli</button>
            <button type="button" className="tsr-chip" aria-pressed={set === 'ph'} onClick={() => { setSet('ph'); setGroup(''); }}>Tek renk (boyanabilir)</button>
          </div>
          {set === 'fl' && list && !query && (
            <div className="tsp-tabs" role="group" aria-label="Süs grubu">
              <button type="button" className="tsr-chip" aria-pressed={!group} onClick={() => setGroup('')}>Öne çıkanlar</button>
              {Object.keys(list.fl).map((g) => (
                <button key={g} type="button" className="tsr-chip" aria-pressed={group === g} onClick={() => setGroup(g)}>{GROUP_LABELS[g] ?? g}</button>
              ))}
            </div>
          )}
        </>
      )}
    >
      <div ref={top} />
      {failed && <p role="alert">Süsler yüklenemedi. Pencereyi kapatıp yeniden açın.</p>}
      {!list && !failed && <p role="status">Süsler yükleniyor…</p>}
      {list && !names.length && <p>Bu aramayla süs bulunamadı. Başka bir sözcük deneyin.</p>}
      <div className="tss-grid">
        {names.slice(0, count).map((name) => (
          <button key={name} type="button" className="tss-item" onClick={() => onPick(set, name)} aria-label={name.replace(/-/g, ' ')} title={name.replace(/-/g, ' ')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={shapeUrl(set, name)} alt="" width={40} height={40} loading="lazy" />
          </button>
        ))}
      </div>
      {count < names.length && (
        <button ref={more} type="button" className="btn btn-outline btn-block" onClick={() => setCount(count + PAGE)}>Daha fazla göster</button>
      )}
    </Pencere>
  );
}
