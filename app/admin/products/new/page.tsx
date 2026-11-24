'use client';

import { useRouter } from 'next/navigation';
import { createProductAction } from '@/lib/actions';
import { Product } from '@/types';
import ProductForm from '@/components/ProductForm';
import Link from 'next/link';
import { useToast } from '@/components/admin/Toast';

export default function NewProductPage() {
  const router = useRouter();
  const toast = useToast();

  const handleSubmit = async (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    await createProductAction({ ...data, createdAt: Date.now(), updatedAt: Date.now() });
    toast.success('Ürün oluşturuldu.');
    router.push('/admin/products');
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <Link href="/admin/products" className="adm-back-link">← Ürünler</Link>
          <h1 className="adm-page-title">Yeni Ürün Ekle</h1>
        </div>
      </div>
      <ProductForm onSubmit={handleSubmit} submitLabel="Ürünü Kaydet" />
    </div>
  );
}
