'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getProductById } from '@/lib/products';
import { updateProductAction } from '@/lib/actions';
import { Product } from '@/types';
import ProductForm from '@/components/ProductForm';
import Link from 'next/link';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getProductById(id).then(setProduct).finally(() => setLoading(false));
    }
  }, [id]);

  const handleSubmit = async (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    await updateProductAction(id, data);
    router.push('/admin/products');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">❌</div>
        <div className="empty-state-title">Ürün bulunamadı</div>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-header">
        <div>
          <div style={{ marginBottom: 6 }}>
            <Link href="/admin/products" style={{ color: 'var(--muted)', fontSize: 14 }}>← Ürünler</Link>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem' }}>Ürünü Düzenle</h1>
          <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 4 }}>{product.title}</p>
        </div>
      </div>
      <ProductForm initial={product} onSubmit={handleSubmit} submitLabel="Değişiklikleri Kaydet" />
    </div>
  );
}
