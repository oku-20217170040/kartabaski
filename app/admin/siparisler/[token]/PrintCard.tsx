'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Mug3D from '@/components/mug3d/Mug3DLazy';
import { MUG_MODELS, mugModelFor, mugPalette } from '@/lib/mug3d';
import { lineHref } from '@/lib/configurator-lines';
import { OrderLine, lineSides, orderImageUrl } from '@/lib/siparis-types';
import type { SideId } from '@/lib/design-sides';
import { displayTitle } from '@/lib/format';
import PrintSide from './PrintSide';
import { useSideContent } from './useSideContent';

interface Props {
  token: string;
  code: string;
  index: number;
  item: OrderLine;
}

/** Bir sipariş kaleminin atölyede bakılacak kartı: ne, kaç adet, hangi renk, her yüze ne basılacak. */
export default function PrintCard({ token, code, index, item }: Props) {
  const sides = lineSides(item);
  const front = useSideContent(token, sides[0]);
  const back = useSideContent(token, sides[1] ?? null);
  const [show3d, setShow3d] = useState(false);
  const [view, setView] = useState<SideId>('front');
  const found = mugModelFor(item.title);
  const model = found ?? MUG_MODELS.luks;
  const colors = useMemo(() => mugPalette(model, item.color), [model, item.color]);

  return (
    <article className="card sip-card prn" aria-labelledby={`prn-${index}`}>
      <header className="prn-head">
        <div>
          <h2 id={`prn-${index}`} className="sip-h2">
            <Link href={lineHref(item.slug)}>{displayTitle(item.title)}</Link>
          </h2>
          <p className="prn-chips">
            {item.color && (
              <span className="prn-chip">
                {found && <i style={{ background: colors.handle !== colors.body ? colors.handle : colors.saucer !== colors.body ? colors.saucer : colors.band !== colors.body ? colors.band : colors.body }} aria-hidden="true" />}
                {item.color}
              </span>
            )}
            <span className={`prn-chip${item.back ? ' is-strong' : ''}`}>{item.back ? 'İki yüze baskı' : 'Tek yüz'}</span>
            {item.needsDesign && <span className="prn-chip is-warn">Tasarımı siz hazırlayacaksınız</span>}
          </p>
        </div>
        <p className="prn-qty"><b>{item.qty}</b><span>adet</span></p>
      </header>

      {item.note && <p className="prn-note"><b>Müşteri notu:</b> {item.note}</p>}

      {item.preview && (
        <a className="prn-preview" href={orderImageUrl(token, item.preview, 900)} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={orderImageUrl(token, item.preview, 900)} alt="Müşterinin gördüğü önizleme, büyütmek için dokunun" />
          <span>Müşterinin gördüğü önizleme</span>
        </a>
      )}

      {found && (front.hasContent || back.hasContent) && (
        show3d ? (
          <div className="prn-3d">
            <Mug3D
              model={found}
              colors={colors}
              label={displayTitle(item.title)}
              {...front.content}
              back={item.back ? back.content : undefined}
              view={view}
              onView={setView}
              onUnsupported={() => setShow3d(false)}
            />
          </div>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShow3d(true)}>Kupada 3D göster</button>
        )
      )}

      {sides.map((side, i) => (
        <PrintSide key={side.label || 'tek'} token={token} code={code} index={index} title={item.title} side={side} data={i ? back : front} model={model} />
      ))}
    </article>
  );
}
