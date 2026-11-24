'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useToast } from '@/components/admin/Toast';
import ConfiguratorItemForm, { ConfiguratorItemFormData } from '@/components/ConfiguratorItemForm';
import { createDesignAction } from '@/lib/actions';

export default function NewDesignPage() {
  const router = useRouter();
  const toast = useToast();

  const handleSubmit = async (data: ConfiguratorItemFormData) => {
    await createDesignAction({
      code:          data.code,
      name:          data.name,
      imagePublicId: data.imagePublicId,
      category:      data.category,
      active:        data.active,
      order:         data.order,
    });
    toast.success('Tasarım eklendi.');
    router.push('/admin/konfigurator');
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <div style={{ marginBottom: 6 }}>
            <Link href="/admin/konfigurator" className="adm-back-link">← Konfiguratör</Link>
          </div>
          <h1 className="adm-page-title">Yeni Tasarım Ekle</h1>
        </div>
      </div>
      <ConfiguratorItemForm
        type="design"
        onSubmit={handleSubmit}
        submitLabel="Tasarımı Kaydet"
        backHref="/admin/konfigurator"
      />
    </div>
  );
}
