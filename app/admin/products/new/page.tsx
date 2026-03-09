'use client';

import { useRouter } from 'next/navigation';
import { createProduct } from '@/lib/products';
import { Product } from '@/types';
import ProductForm from '@/components/ProductForm';
import Link from 'next/link';

export default function NewProductPage() {
  const router = useRouter();

  const handleSubmit = async (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    await createProduct({ ...data, createdAt: Date.now(), updatedAt: Date.now() });
    router.push('/admin/products');
  };

  return (
    <div>
      <div className="admin-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <Link href="/admin/products" style={{ color: 'var(--muted)', fontSize: 14 }}>← Ürünler</Link>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem' }}>Yeni Ürün Ekle</h1>
        </div>
      </div>
      <ProductForm onSubmit={handleSubmit} submitLabel="Ürünü Kaydet" />
    </div>
  );
}
