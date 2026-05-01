'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { updateDesignAction } from '@/lib/actions';
import { ConfiguratorDesign } from '@/types';
import ConfiguratorItemForm, { ConfiguratorItemFormData } from '@/components/ConfiguratorItemForm';

export default function EditDesignPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [design,  setDesign]  = useState<ConfiguratorDesign | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDoc(doc(db, 'configurator_designs', id)).then(snap => {
      if (snap.exists()) setDesign({ id: snap.id, ...snap.data() } as ConfiguratorDesign);
      setLoading(false);
    });
  }, [id]);

  const handleSubmit = async (data: ConfiguratorItemFormData) => {
    await updateDesignAction(id, {
      code:          data.code,
      name:          data.name,
      imagePublicId: data.imagePublicId,
      active:        data.active,
      order:         data.order,
    });
    router.push('/admin/konfigurator');
  };

  if (loading) return (
    <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}><div className="spinner" /></div>
  );

  if (!design) return (
    <div className="empty-state">
      <div className="empty-state-title">Tasarım bulunamadı</div>
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
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem' }}>Tasarımı Düzenle — {design.name}</h1>
        </div>
      </div>
      <ConfiguratorItemForm
        type="design"
        initial={design}
        onSubmit={handleSubmit}
        submitLabel="Değişiklikleri Kaydet"
        backHref="/admin/konfigurator"
      />
    </div>
  );
}
