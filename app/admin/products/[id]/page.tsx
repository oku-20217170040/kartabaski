'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getProductById } from '@/lib/products';
import { updateProductAction } from '@/lib/actions';
import { Product } from '@/types';
import ProductForm from '@/components/ProductForm';
import Link from 'next/link';
import { useToast } from '@/components/admin/Toast';

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      getProductById(id).then(setProduct).finally(() => setLoading(false));
    }
  }, [id]);

  const handleSubmit = async (data: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => {
    const { error } = await updateProductAction(id, data);
    if (error) throw new Error(error);
    toast.success('Değişiklikler kaydedildi.');
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
        <div className="empty-state-title">Ürün bulunamadı</div>
        <Link href="/admin/products" className="btn btn-secondary" style={{ marginTop: 12 }}>← Ürünler</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-header">
        <div>
          <Link href="/admin/products" className="adm-back-link">← Ürünler</Link>
          <h1 className="adm-page-title">Ürünü Düzenle</h1>
          <p className="adm-page-sub">{product.title}</p>
        </div>
      </div>
      <ProductForm initial={product} onSubmit={handleSubmit} submitLabel="Değişiklikleri Kaydet" />
    </div>
  );
}
