'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/admin/Toast';
import ConfiguratorItemForm, { ConfiguratorItemFormData } from '@/components/ConfiguratorItemForm';
import { createCupAction } from '@/lib/actions';

export default function NewCupPage() {
  const router = useRouter();
  const toast = useToast();

  const handleSubmit = async (data: ConfiguratorItemFormData) => {
    await createCupAction({
      code:          data.code,
      name:          data.name,
      price:         data.price ?? 0,
      imagePublicId: data.imagePublicId,
      colors:        data.colors,
      active:        data.active,
      order:         data.order,
    });
    toast.success('Bardak eklendi.');
    router.push('/admin/konfigurator');
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <div style={{ marginBottom: 6 }}>
            <Link href="/admin/konfigurator" className="adm-back-link">← Konfiguratör</Link>
          </div>
          <h1 className="adm-page-title">Yeni Bardak Ekle</h1>
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
