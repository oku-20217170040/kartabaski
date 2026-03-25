'use client';

import { useEffect, useState } from 'react';
import { getSatisTalepleri, updateSatisTalebiStatus, deleteSatisTalebi, SatisTalebi } from '@/lib/products';

const STATUS_LABELS: Record<SatisTalebi['status'], { label: string; badge: string }> = {
  yeni:       { label: 'Yeni',       badge: 'badge-blue' },
  incelendi:  { label: 'İncelendi',  badge: 'badge-orange' },
  reddedildi: { label: 'Reddedildi', badge: 'badge-red' },
};

export default function SatisTalepleriPage() {
  const [talepler, setTalepler] = useState<SatisTalebi[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [filter, setFilter] = useState<SatisTalebi['status'] | 'tumu'>('tumu');

  const load = () => {
    setLoading(true);
    getSatisTalepleri().then(setTalepler).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleStatus = async (id: string, status: SatisTalebi['status']) => {
    setUpdating(id);
    await updateSatisTalebiStatus(id, status);
    setTalepler((prev) => prev.map((t) => t.id === id ? { ...t, status } : t));
    setUpdating(null);
  };

  const handleDelete = async (id: string, itemName: string) => {
    if (!confirm(`"${itemName}" talebini silmek istediğinize emin misiniz?`)) return;
    setDeleting(id);
    await deleteSatisTalebi(id);
    setTalepler((prev) => prev.filter((t) => t.id !== id));
    setDeleting(null);
  };

  const filtered = filter === 'tumu' ? talepler : talepler.filter((t) => t.status === filter);
  const yeniCount = talepler.filter((t) => t.status === 'yeni').length;

  const formatDate = (ts: number) => new Date(ts).toLocaleDateString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem' }}>Satış Talepleri</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
            {talepler.length} talep
            {yeniCount > 0 && (
              <span style={{ marginLeft: 10, color: 'var(--accent2)', fontWeight: 700 }}>
                🔵 {yeniCount} yeni
              </span>
            )}
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={load}>↻ Yenile</button>
      </div>

      {/* Filtre */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['tumu', 'yeni', 'incelendi', 'reddedildi'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-ghost'}`}
          >
            {s === 'tumu' ? 'Tümü' : STATUS_LABELS[s].label}
            {s === 'yeni' && yeniCount > 0 && (
              <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: '0 6px', marginLeft: 4, fontSize: 11 }}>
                {yeniCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
            <div className="spinner" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-title">Talep bulunamadı</div>
          </div>
        ) : filtered.map((t) => (
          <div
            key={t.id}
            className="card"
            style={{
              padding: '20px 24px',
              borderLeft: t.status === 'yeni' ? '3px solid var(--accent2)' : '3px solid transparent',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
              {/* Sol: bilgiler */}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.05rem' }}>
                    {t.itemName}
                  </span>
                  <span className={`badge ${STATUS_LABELS[t.status].badge}`}>
                    {STATUS_LABELS[t.status].label}
                  </span>
                  <span className="badge badge-muted">{t.category}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px 20px', fontSize: 13 }}>
                  <div><span style={{ color: 'var(--muted)' }}>👤 Ad:</span> <strong>{t.name}</strong></div>
                  <div>
                    <span style={{ color: 'var(--muted)' }}>📱 Tel:</span>{' '}
                    <a href={`tel:${t.phone}`} style={{ color: 'var(--accent)', fontWeight: 600 }}>{t.phone}</a>
                  </div>
                  <div><span style={{ color: 'var(--muted)' }}>🔧 Kondisyon:</span> {t.condition}</div>
                  {t.price && <div><span style={{ color: 'var(--muted)' }}>💰 Beklenen:</span> <strong style={{ color: 'var(--accent)' }}>₺{t.price}</strong></div>}
                  <div><span style={{ color: 'var(--muted)' }}>🕐</span> {formatDate(t.createdAt)}</div>
                </div>

                {t.description && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg)', borderRadius: 8, fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                    💬 {t.description}
                  </div>
                )}
              </div>

              {/* Sağ: aksiyonlar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 140 }}>
                <a
                  href={`https://wa.me/${t.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Merhaba ${t.name}, "${t.itemName}" ürününüz hakkında fiyat teklifimizi iletmek istiyoruz.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary btn-sm"
                  style={{ justifyContent: 'center' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                  </svg>
                  WhatsApp
                </a>

                {t.status !== 'incelendi' && (
                  <button
                    className="btn btn-secondary btn-sm"
                    disabled={updating === t.id}
                    onClick={() => handleStatus(t.id!, 'incelendi')}
                  >
                    ✓ İncelendi
                  </button>
                )}
                {t.status !== 'reddedildi' && (
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={updating === t.id}
                    onClick={() => handleStatus(t.id!, 'reddedildi')}
                  >
                    ✗ Reddet
                  </button>
                )}
                <button
                  className="btn btn-sm"
                  disabled={deleting === t.id}
                  onClick={() => handleDelete(t.id!, t.itemName)}
                  style={{
                    background: 'rgba(248,81,73,0.08)',
                    border: '1px solid rgba(248,81,73,0.25)',
                    color: '#f85149',
                    marginTop: 4,
                  }}
                >
                  {deleting === t.id ? '...' : '🗑 Sil'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
