'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ConfiguratorItemForm, { ConfiguratorItemFormData } from '@/components/ConfiguratorItemForm';
import { createCupAction } from '@/lib/actions';

export default function NewCupPage() {
  const router = useRouter();

  const handleSubmit = async (data: ConfiguratorItemFormData) => {
    await createCupAction({
      code:          data.code,
      name:          data.name,
      price:         data.price ?? 0,
      imagePublicId: data.imagePublicId,
      active:        data.active,
      order:         data.order,
    });
    router.push('/admin/konfigurator');
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <div style={{ marginBottom: 6 }}>
            <Link href="/admin/konfigurator" style={{ color: 'var(--muted)', fontSize: 14 }}>← Konfiguratör</Link>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem' }}>Yeni Bardak Ekle</h1>
        </div>
      </div>
      <ConfiguratorItemForm
        type="cup"
        onSubmit={handleSubmit}
        submitLabel="Bardağı Kaydet"
        backHref="/admin/konfigurator"
      />
    </div>
  );
}
