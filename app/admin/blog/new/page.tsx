'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import PostEditor from '@/components/admin/PostEditor';

export default function NewPostPage() {
  const router = useRouter();
  return (
    <div>
      <div className="admin-header">
        <div>
          <Link href="/admin/blog" className="adm-back-link">← Blog</Link>
          <h1 className="adm-page-title">Yeni yazı</h1>
        </div>
      </div>
      <PostEditor onSaved={() => router.push('/admin/blog')} />
    </div>
  );
}
