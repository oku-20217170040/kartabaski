'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { deleteCupAction, deleteDesignAction } from '@/lib/actions';
import { ConfiguratorCup, ConfiguratorDesign } from '@/types';
import { useToast, errorMessage } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmDialog';
import { IconCup, IconPalette } from '@/components/admin/icons';

export default function AdminKonfiguratorPage() {
  const toast = useToast();
  const { confirm, dialog } = useConfirm();
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
    } catch {
      toast.error('Konfiguratör verileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const runDelete = async (
    id: string,
    name: string,
    kind: 'bardağı' | 'tasarımı',
    action: (id: string) => Promise<void>,
  ) => {
    const ok = await confirm({
      title: `${kind === 'bardağı' ? 'Bardak' : 'Tasarım'} silinsin mi?`,
      message: <><strong>{name}</strong> ve görselleri kalıcı olarak silinecek. Bu işlem geri alınamaz.</>,
      confirmLabel: 'Sil',
      danger: true,
    });
    if (!ok) return;
    setDeleting(id);
    try {
      await action(id);
      toast.success(`"${name}" silindi.`);
      await load();
    } catch (e) {
      toast.error(errorMessage(e, 'Silme işlemi başarısız.'));
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteCup = (id: string, name: string) => runDelete(id, name, 'bardağı', deleteCupAction);
  const handleDeleteDesign = (id: string, name: string) => runDelete(id, name, 'tasarımı', deleteDesignAction);

  return (
    <div>
      <div className="admin-header">
        <div>
          <h1 className="adm-page-title">Konfiguratör Yönetimi</h1>
          <p className="adm-page-sub">
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
        <div className="adm-two-col">

          {/* ── BARDAKLAR ── */}
          <div>
            <h2 className="adm-section-title">
              Bardaklar ({cups.length})
            </h2>
            {cups.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><IconCup size={40} /></div>
                <div className="empty-state-title">Henüz bardak yok</div>
                <Link href="/admin/konfigurator/cups/new" className="btn btn-primary adm-empty-cta">
                  + İlk Bardağı Ekle
                </Link>
              </div>
            ) : (
              <div className="adm-list">
                {cups.map(cup => (
                  <div key={cup.id} className={`card adm-row ${cup.active ? '' : 'is-inactive'}`}>
                    <div className="adm-cfg-thumb">
                      {cup.imagePublicId ? (
                        <Image
                          src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/w_88,h_88,c_fill,f_auto,q_auto/${cup.imagePublicId}`}
                          alt={cup.name}
                          fill
                          style={{ objectFit: 'cover' }}
                          sizes="44px"
                        />
                      ) : null}
                    </div>
                    <div className="adm-row-main">
                      <div className="adm-row-title">{cup.name}</div>
                      <div className="adm-row-slug">
                        <span className="adm-code">{cup.code}</span>
                        <span className="adm-price">{cup.price}₺</span>
                        <span>Sıra: {cup.order}</span>
                      </div>
                    </div>
                    <div className="adm-row-buttons">
                      <span className={`badge ${cup.active ? 'badge-green' : 'badge-muted'}`}>
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
            <h2 className="adm-section-title">
              Tasarımlar ({designs.length})
            </h2>
            {designs.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><IconPalette size={40} /></div>
                <div className="empty-state-title">Henüz tasarım yok</div>
                <Link href="/admin/konfigurator/designs/new" className="btn btn-primary adm-empty-cta">
                  + İlk Tasarımı Ekle
                </Link>
              </div>
            ) : (
              <div className="adm-list">
                {designs.map(design => (
                  <div key={design.id} className={`card adm-row ${design.active ? '' : 'is-inactive'}`}>
                    <div className="adm-cfg-thumb">
                      {design.imagePublicId ? (
                        <Image
                          src={`https://res.cloudinary.com/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload/w_88,h_88,c_fill,f_auto,q_auto/${design.imagePublicId}`}
                          alt={design.name}
                          fill
                          style={{ objectFit: 'cover' }}
                          sizes="44px"
                        />
                      ) : null}
                    </div>
                    <div className="adm-row-main">
                      <div className="adm-row-title">{design.name}</div>
                      <div className="adm-row-slug">
                        <span className="adm-code">{design.code}</span>
                        <span>Sıra: {design.order}</span>
                      </div>
                    </div>
                    <div className="adm-row-buttons">
                      <span className={`badge ${design.active ? 'badge-green' : 'badge-muted'}`}>
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
      {dialog}
    </div>
  );
}
