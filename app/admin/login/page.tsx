'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';

export default function AdminLoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      const next = new URLSearchParams(window.location.search).get('next');
      router.push(next && next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin');
    } catch (e) {
      const status = (e as { status?: number })?.status;
      setError(status ? (e as Error).message : 'E-posta veya şifre hatalı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="adm-login">
      <aside className="adm-login-brand">
        <Image src="/logo.png" alt="KAR-TA BASKI" width={56} height={56} priority style={{ objectFit: 'contain' }} />
        <div className="adm-login-brand-body">
          <h1 className="adm-login-title">KAR-TA BASKI yönetim paneli</h1>
          <p className="adm-login-lead">Ürünleri, görselleri ve konfiguratörü tek yerden sakin ve düzenli şekilde yönetin.</p>
        </div>
        <span className="adm-sidebar-sub">Yönetim paneli</span>
      </aside>

      <main className="adm-login-panel">
        <div className="adm-login-card card">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
            style={{ padding: 28 }}
            noValidate
          >
            <h2>Giriş yap</h2>
            <p className="adm-login-hint">Devam etmek için yönetici hesabınızı kullanın.</p>

            <div className="form-group">
              <label className="form-label" htmlFor="adm-email">E-posta</label>
              <input
                id="adm-email"
                className="form-input"
                type="email"
                name="email"
                autoComplete="username"
                inputMode="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="adm-password">Şifre</label>
              <div className="adm-login-pass">
                <input
                  id="adm-password"
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="adm-login-eye"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                  aria-pressed={showPassword}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                    {showPassword ? (
                      <>
                        <path d="M3 3l18 18" />
                        <path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-3.2 3.7M6.5 6.8A15 15 0 0 0 3 12s4 6 9 6a9 9 0 0 0 3.5-.7" />
                        <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                      </>
                    ) : (
                      <>
                        <path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6Z" />
                        <circle cx="12" cy="12" r="3" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
            </div>

            <div aria-live="assertive">
              {error && <div className="adm-alert" role="alert">{error}</div>}
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-full btn-lg"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (
                <span className="adm-login-btn-label"><span className="adm-login-spin" aria-hidden="true" /> Giriş yapılıyor...</span>
              ) : 'Giriş Yap'}
            </button>

            <Link href="/" className="adm-login-back">&larr; Siteye dön</Link>
          </form>
        </div>
      </main>
    </div>
  );
}
