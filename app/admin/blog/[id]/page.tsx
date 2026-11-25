'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import PostEditor from '@/components/admin/PostEditor';
import { getPostAdminAction } from '@/lib/actions-blog';
import type { Post } from '@/lib/posts-types';

export default function EditPostPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPostAdminAction(id).then(setPost).catch(() => setPost(null)).finally(() => setLoading(false));
  }, [id]);

  return (
    <div>
      <div className="admin-header">
        <div>
          <Link href="/admin/blog" className="adm-back-link">← Blog</Link>
          <h1 className="adm-page-title">Yazıyı düzenle</h1>
        </div>
      </div>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}><div className="spinner" /></div>
      ) : !post ? (
        <div className="adm-empty"><div className="adm-empty-title">Yazı bulunamadı</div></div>
      ) : (
        <PostEditor initial={post} onSaved={() => router.push('/admin/blog')} />
      )}
    </div>
  );
}
