'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ConfiguratorItemForm, { ConfiguratorItemFormData } from '@/components/ConfiguratorItemForm';
import { createDesignAction } from '@/lib/actions';

export default function NewDesignPage() {
  const router = useRouter();

  const handleSubmit = async (data: ConfiguratorItemFormData) => {
    await createDesignAction({
      code:          data.code,
      name:          data.name,
      imagePublicId: data.imagePublicId,
      gradient:      data.gradient,
      textColor:     data.textColor,
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
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem' }}>Yeni Tasarım Ekle</h1>
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
