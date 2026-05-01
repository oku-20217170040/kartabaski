'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { updateCupAction } from '@/lib/actions';
import { ConfiguratorCup } from '@/types';
import ConfiguratorItemForm, { ConfiguratorItemFormData } from '@/components/ConfiguratorItemForm';

export default function EditCupPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [cup,     setCup]     = useState<ConfiguratorCup | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, 'configurator_cups', id)).then(snap => {
      if (snap.exists()) setCup({ id: snap.id, ...snap.data() } as ConfiguratorCup);
      setLoading(false);
    });
  }, [id]);

  const handleSubmit = async (data: ConfiguratorItemFormData) => {
    await updateCupAction(id, {
      code:          data.code,
      name:          data.name,
      price:         data.price ?? 0,
      imagePublicId: data.imagePublicId,
      active:        data.active,
      order:         data.order,
    });
    router.push('/admin/konfigurator');
  };

  if (loading) return (
    <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
  );

  if (!cup) return (
    <div className="empty-state">
      <div className="empty-state-title">Bardak bulunamadı</div>
      <Link href="/admin/konfigurator" className="btn btn-secondary" style={{ marginTop: 12 }}>← Geri</Link>
    </div>
  );

  return (
    <div>
      <div className="admin-header">
        <div>
          <div style={{ marginBottom: 6 }}>
            <Link href="/admin/konfigurator" style={{ color: 'var(--muted)', fontSize: 14 }}>← Konfiguratör</Link>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem' }}>Bardağı Düzenle — {cup.name}</h1>
        </div>
      </div>
      <ConfiguratorItemForm
        type="cup"
        initial={cup}
        onSubmit={handleSubmit}
        submitLabel="Değişiklikleri Kaydet"
        backHref="/admin/konfigurator"
      />
    </div>
  );
}
