'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { deleteCupAction, deleteDesignAction } from '@/lib/actions';
import { ConfiguratorCup, ConfiguratorDesign } from '@/types';

export default function AdminKonfiguratorPage() {
  const [cups,    setCups]    = useState<ConfiguratorCup[]>([]);
  const [designs, setDesigns] = useState<ConfiguratorDesign[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [cupsSnap, designsSnap] = await Promise.all([
        getDocs(query(collection(db, 'configurator_cups'),    orderBy('order'))),
        getDocs(query(collection(db, 'configurator_designs'), orderBy('order'))),
      ]);
      setCups(cupsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ConfiguratorCup)));
      setDesigns(designsSnap.docs.map(d => ({ id: d.id, ...d.data() } as ConfiguratorDesign)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDeleteCup = async (id: string, name: string) => {
    if (!confirm(`"${name}" bardağı silinsin mi?`)) return;
    setDeleting(id);
    await deleteCupAction(id);
    await load();
    setDeleting(null);
  };

  const handleDeleteDesign = async (id: string, name: string) => {
    if (!confirm(`"${name}" tasarımı silinsin mi?`)) return;
    setDeleting(id);
    await deleteDesignAction(id);
    await load();
    setDeleting(null);
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem' }}>Konfiguratör Yönetimi</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
            {cups.length} bardak · {designs.length} tasarım
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/admin/konfigurator/cups/new"    className="btn btn-primary">+ Bardak Ekle</Link>
          <Link href="/admin/konfigurator/designs/new" className="btn btn-secondary">+ Tasarım Ekle</Link>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

          {/* ── BARDAKLAR ── */}
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', marginBottom: 12 }}>
              Bardaklar ({cups.length})
            </h2>
            {cups.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">☕</div>
                <div className="empty-state-title">Henüz bardak yok</div>
                <Link href="/admin/konfigurator/cups/new" className="btn btn-primary" style={{ marginTop: 12 }}>
                  + İlk Bardağı Ekle
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {cups.map(cup => (
                  <div key={cup.id} className="card" style={{
                    padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center',
                    opacity: cup.active ? 1 : 0.55,
                  }}>
                    {/* Renk önizleme */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                      background: cup.gradient,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, color: cup.textColor,
                    }}>
                      {cup.code}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{cup.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 8 }}>
                        <span style={{ fontFamily: 'monospace', background: 'rgba(201,168,76,0.12)', color: 'var(--accent)', borderRadius: 4, padding: '1px 6px', fontSize: 11, border: '1px solid rgba(201,168,76,0.25)' }}>{cup.code}</span>
                        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{cup.price}₺</span>
                        <span>Sıra: {cup.order}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                      <span className={`badge ${cup.active ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 11 }}>
                        {cup.active ? 'Aktif' : 'Pasif'}
                      </span>
                      <Link href={`/admin/konfigurator/cups/${cup.id}`} className="btn btn-secondary btn-sm">Düzenle</Link>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={deleting === cup.id}
                        onClick={() => handleDeleteCup(cup.id, cup.name)}
                      >{deleting === cup.id ? '...' : 'Sil'}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── TASARIMLAR ── */}
          <div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', marginBottom: 12 }}>
              Tasarımlar ({designs.length})
            </h2>
            {designs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🎨</div>
                <div className="empty-state-title">Henüz tasarım yok</div>
                <Link href="/admin/konfigurator/designs/new" className="btn btn-primary" style={{ marginTop: 12 }}>
                  + İlk Tasarımı Ekle
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {designs.map(design => (
                  <div key={design.id} className="card" style={{
                    padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center',
                    opacity: design.active ? 1 : 0.55,
                  }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 8, flexShrink: 0,
                      background: design.gradient,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, color: design.textColor,
                    }}>
                      {design.code}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{design.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 8 }}>
                        <span style={{ fontFamily: 'monospace', background: 'rgba(201,168,76,0.12)', color: 'var(--accent)', borderRadius: 4, padding: '1px 6px', fontSize: 11, border: '1px solid rgba(201,168,76,0.25)' }}>{design.code}</span>
                        <span>Sıra: {design.order}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                      <span className={`badge ${design.active ? 'badge-green' : 'badge-red'}`} style={{ fontSize: 11 }}>
                        {design.active ? 'Aktif' : 'Pasif'}
                      </span>
                      <Link href={`/admin/konfigurator/designs/${design.id}`} className="btn btn-secondary btn-sm">Düzenle</Link>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={deleting === design.id}
                        onClick={() => handleDeleteDesign(design.id, design.name)}
                      >{deleting === design.id ? '...' : 'Sil'}</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
