'use client';
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useState } from 'react';
import {
  ertleAction, getPaylasimPanelAction, gorsellerAction, hemenAction, iptalAction, kademeOnayAction,
  kapakAction, metinAction, saveAyarAction, tekrarAction, type PanelData,
} from '@/lib/actions-paylasim';
import { cloudinaryThumb } from '@/lib/format';
import type { Paylasim, Kademe } from '@/lib/paylasim/types';
import type { SocialPlatform } from '@/lib/social-types';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import './paylasim.css';

const TABS = ['Sırada', 'Yayınlanan', 'Fiyatlar ve kapaklar', 'Ayarlar'] as const;
const NAMES: Record<SocialPlatform, string> = { instagram: 'Instagram', facebook: 'Facebook', threads: 'Threads', telegram: 'Telegram', pinterest: 'Pinterest', tiktok: 'TikTok' };
const DURUM: Record<string, string> = { bekliyor: 'Bekliyor', gonderiliyor: 'Gönderiliyor', tamam: 'Yayınlandı', hata: 'Hata', atlandi: 'Atlandı', belirsiz: 'Belirsiz, kontrol edin', yayinlandi: 'Yayınlandı', kismi: 'Kısmen', iptal: 'İptal' };
const when = (ts: number) => new Date(ts).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', weekday: 'short', hour: '2-digit', minute: '2-digit' });

export default function PaylasimPage() {
  const [data, setData] = useState<PanelData | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]>('Sırada');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { confirm, dialog } = useConfirm();

  const load = useCallback(() => getPaylasimPanelAction().then(setData).catch((e) => toast.error(errorMessage(e, 'Panel yüklenemedi'))), [toast]);
  useEffect(() => { void load(); }, [load]);

  const run = async (job: () => Promise<{ error?: string }>, ok: string) => {
    setBusy(true);
    try {
      const { error } = await job();
      if (error) toast.error(error); else toast.success(ok);
      await load();
    }
    catch (e) { toast.error(errorMessage(e, 'İşlem yapılamadı')); }
    finally { setBusy(false); }
  };

  if (!data) return <p className="pl-empty">Yükleniyor…</p>;
  const title = (id: string) => data.urunler.find((u) => u.id === id)?.title ?? 'Ürün';
  const waiting = data.items.filter((i) => i.status === 'bekliyor');
  const done = data.items.filter((i) => i.status === 'yayinlandi' || i.status === 'kismi' || i.status === 'hata').reverse();
  const unapproved = data.urunler.filter((u) => !u.approved).length;

  const card = (item: Paylasim) => {
    const product = data.urunler.find((u) => u.id === item.productId);
    return (
      <article key={item.key} className="pl-card">
        <header>
          <strong>{item.kind === 'hikaye' ? 'Hikâye' : 'Karusel'} · {title(item.productId)}{item.color ? ` · ${item.color}` : ''}</strong>
          <span>{when(item.at)} · {DURUM[item.status]}</span>
        </header>
        <div className="pl-images">{item.imageIds.map((id) => <img key={id} src={cloudinaryThumb(id)} alt="" loading="lazy" />)}</div>
        {Object.entries(item.targets).length > 0 && (
          <ul className="pl-targets">
            {(Object.entries(item.targets) as [SocialPlatform, NonNullable<Paylasim['targets'][SocialPlatform]>][]).map(([p, t]) => (
              <li key={p} data-status={t.status}>
                {NAMES[p]}: {DURUM[t.status]}{t.error ? ` (${t.error})` : ''}
                {(t.status === 'hata' || t.status === 'belirsiz') && (
                  <button disabled={busy} onClick={async () => { if (await confirm({ title: 'Yeniden gönderilsin mi?', message: 'Platformda yayınlanmadığından emin olun.' })) void run(() => tekrarAction(item.key, p), 'Yeniden denendi'); }}>Yeniden dene</button>
                )}
              </li>
            ))}
          </ul>
        )}
        {item.status === 'bekliyor' && (
          <>
            {item.kind === 'karusel' && (
              <details>
                <summary>Metni düzenle</summary>
                <textarea defaultValue={data.captions[item.key]} rows={10} onBlur={(e) => { if (e.target.value !== data.captions[item.key]) void run(() => metinAction(item.key, e.target.value), 'Metin kaydedildi'); }} />
              </details>
            )}
            <details>
              <summary>Görselleri değiştir</summary>
              <div className="pl-pick">
                {product?.images.map((id) => {
                  const on = item.imageIds.includes(id);
                  const next = item.kind === 'hikaye' ? [id] : on ? item.imageIds.filter((x) => x !== id) : [...item.imageIds, id];
                  return <button key={id} aria-pressed={on} disabled={busy} onClick={() => void run(() => gorsellerAction(item.key, next), 'Görseller kaydedildi')}><img src={cloudinaryThumb(id)} alt="" loading="lazy" /></button>;
                })}
              </div>
            </details>
            <div className="pl-actions">
              <button className="is-primary" disabled={busy} onClick={async () => { if (await confirm({ title: 'Hemen paylaşılsın mı?', message: 'Bağlı tüm platformlarda yayınlanır.' })) void run(() => hemenAction(item.key), 'Gönderildi'); }}>Hemen paylaş</button>
              {item.kind === 'karusel' && <button disabled={busy} onClick={() => void run(() => ertleAction(item.key), 'Ertelendi')}>Ertele</button>}
              <button disabled={busy} onClick={async () => { if (await confirm({ title: 'İptal edilsin mi?', message: 'Bu paylaşım bir daha sıraya girmez.' })) void run(() => iptalAction(item.key), 'İptal edildi'); }}>İptal et</button>
            </div>
          </>
        )}
      </article>
    );
  };

  return (
    <>
    {dialog}
    <div className="pl">
      <h1>Paylaşım Paneli</h1>
      <p className="pl-state">
        {data.ayar.paused ? 'Durduruldu.' : data.ayar.mode === 'canli' ? 'Canlı: zamanı gelen paylaşımlar yayınlanır.' : 'Önizleme: sıra oluşur, hiçbir şey yayınlanmaz.'}
        {unapproved > 0 && ` ${unapproved} ürün fiyat onayı bekliyor.`}
      </p>
      <nav className="pl-tabs">{TABS.map((t) => <button key={t} aria-current={t === tab} onClick={() => setTab(t)}>{t}</button>)}</nav>

      {tab === 'Sırada' && (waiting.length ? waiting.map(card) : <p className="pl-empty">Sırada paylaşım yok. Önce fiyatları onaylayın.</p>)}
      {tab === 'Yayınlanan' && (done.length ? done.map(card) : <p className="pl-empty">Henüz yayın yok.</p>)}

      {tab === 'Fiyatlar ve kapaklar' && data.urunler.map((u) => (
        <article key={u.id} className="pl-card">
          <header><strong>{u.title}</strong><span>{u.approved ? 'Onaylı' : 'Onay bekliyor'}</span></header>
          <TierEditor key={JSON.stringify(u.tiers)} tiers={u.tiers} busy={busy} onSave={(t) => void run(() => kademeOnayAction(u.id, t), 'Fiyatlar onaylandı')} />
          <details>
            <summary>Kapak seç</summary>
            {u.groups.map((g) => (
              <div key={g.key}>
                <h2>{g.name}</h2>
                <div className="pl-pick">
                  {g.images.map((id) => (
                    <button key={id} aria-pressed={data.ayar.covers[g.key] === id} disabled={busy} title={data.white[id] ? 'Düz zemin' : 'Temalı'} onClick={() => void run(() => kapakAction(g.key, id), 'Kapak kaydedildi')}>
                      <img src={cloudinaryThumb(id)} alt="" loading="lazy" />
                    </button>
                  ))}
                </div>
                {g.images.every((id) => data.white[id]) && <p>Temalı kapak yok.</p>}
              </div>
            ))}
          </details>
        </article>
      ))}

      {tab === 'Ayarlar' && (
        <article className="pl-card">
          <div className="pl-actions">
            <button disabled={busy} onClick={() => void run(() => saveAyarAction({ paused: !data.ayar.paused }), 'Kaydedildi')}>{data.ayar.paused ? 'Devam ettir' : 'Hepsini durdur'}</button>
            <button className="is-primary" disabled={busy} onClick={async () => {
              const live = data.ayar.mode === 'canli';
              if (await confirm({ title: live ? 'Önizlemeye dönülsün mü?' : 'Canlıya alınsın mı?', message: live ? 'Eski ürün otomasyonu yeniden çalışır.' : 'Zamanı gelen paylaşımlar yayınlanır; eski ürün ve hikâye otomasyonu kapanır.' })) {
                void run(() => saveAyarAction({ mode: live ? 'onizleme' : 'canli' }), 'Kaydedildi');
              }
            }}>{data.ayar.mode === 'canli' ? 'Önizlemeye dön' : 'Canlıya al'}</button>
          </div>
          {(Object.keys(NAMES) as SocialPlatform[]).map((p) => (
            <label key={p} className="pl-check">
              <input type="checkbox" checked={data.ayar.platforms[p]} disabled={busy} onChange={(e) => void run(() => saveAyarAction({ platforms: { ...data.ayar.platforms, [p]: e.target.checked } }), 'Kaydedildi')} />
              {NAMES[p]}
            </label>
          ))}
          {(['karusel', 'hikaye'] as const).map((k) => (
            <label key={k} className="pl-check">
              <input type="checkbox" checked={data.ayar.kinds[k]} disabled={busy} onChange={(e) => void run(() => saveAyarAction({ kinds: { ...data.ayar.kinds, [k]: e.target.checked } }), 'Kaydedildi')} />
              {k === 'karusel' ? 'Ürün karuselleri' : 'Fiyatlı hikâyeler'}
            </label>
          ))}
          {(['carouselTimes', 'storyTimes'] as const).map((k) => (
            <label key={k} className="pl-times">
              {k === 'carouselTimes' ? 'Karusel saatleri' : 'Hikâye saatleri'}
              <input defaultValue={data.ayar[k].join(', ')} onBlur={(e) => { if (e.target.value !== data.ayar[k].join(', ')) void run(() => saveAyarAction({ [k]: e.target.value.split(',').map((s) => s.trim()) }), 'Saatler kaydedildi'); }} />
            </label>
          ))}
          <p>Saat değişikliği, henüz oluşturulmamış paylaşımlara uygulanır.</p>
        </article>
      )}
    </div>
    </>
  );
}

function TierEditor({ tiers, busy, onSave }: { tiers: Kademe[]; busy: boolean; onSave: (t: Kademe[]) => void }) {
  const [rows, setRows] = useState<Kademe[]>(tiers.length ? tiers : [{ label: '', price: '' }]);
  const set = (i: number, patch: Partial<Kademe>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="pl-tiers">
      {rows.map((r, i) => (
        <div key={i}>
          <input aria-label="Kademe" value={r.label} onChange={(e) => set(i, { label: e.target.value })} />
          <input aria-label="Fiyat" value={r.price} onChange={(e) => set(i, { price: e.target.value })} />
          <button aria-label="Satırı sil" onClick={() => setRows(rows.filter((_, j) => j !== i))}>Sil</button>
        </div>
      ))}
      <div className="pl-actions">
        <button disabled={rows.length >= 7} onClick={() => setRows([...rows, { label: '', price: '' }])}>Satır ekle</button>
        <button className="is-primary" disabled={busy} onClick={() => onSave(rows)}>Onayla</button>
      </div>
    </div>
  );
}
