'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { IconAlert, IconCheck, IconClose } from './icons';

type ToastKind = 'success' | 'error';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const DURATION: Record<ToastKind, number> = { success: 3500, error: 6000 };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++idRef.current;
      setItems((prev) => [...prev.slice(-3), { id, kind, message }]);
      timers.current.set(id, setTimeout(() => dismiss(id), DURATION[kind]));
    },
    [dismiss]
  );

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => clearTimeout(t));
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (m) => push('success', m),
      error: (m) => push('error', m),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="adm-toast-region" role="region" aria-label="Bildirimler" aria-live="polite" aria-relevant="additions">
        {items.map((t) => (
          <div key={t.id} className={`adm-toast adm-toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <span className="adm-toast-icon">
              {t.kind === 'success' ? <IconCheck size={16} /> : <IconAlert size={16} />}
            </span>
            <span className="adm-toast-msg">{t.message}</span>
            <button type="button" className="adm-toast-close" onClick={() => dismiss(t.id)} aria-label="Bildirimi kapat">
              <IconClose size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // Provider dışında çağrılırsa çökmeden konsola düş
    return {
      success: (m) => console.info('[toast]', m),
      error: (m) => console.error('[toast]', m),
    };
  }
  return ctx;
}

/** Server action hatalarından kullanıcıya gösterilecek mesajı çıkarır. */
export function errorMessage(e: unknown, fallback = 'Bir hata oluştu. Lütfen tekrar deneyin.'): string {
  const msg = e instanceof Error ? e.message : '';
  if (!msg) return fallback;
  if (msg.includes('Yetkisiz')) return 'Yetkisiz işlem. Oturumunuz sona ermiş olabilir, tekrar giriş yapın.';
  // Next.js production derlemesinde server action hata mesajlarını gizler
  if (msg.includes('Server Components render') || msg.includes('omitted in production')) return fallback;
  return msg;
}
