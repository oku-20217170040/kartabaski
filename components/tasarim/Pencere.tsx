'use client';

import { useEffect, useRef } from 'react';
import { CloseIcon } from '@/components/icons';

interface Props {
  title: string;
  onClose: () => void;
  /** Başlığın altında sabit kalan arama ve süzgeçler. */
  tools?: React.ReactNode;
  children: React.ReactNode;
}

/** Seçim penceresi: masaüstünde ortada, telefonda alttan açılır. Odak ve Esc tarayıcının. */
export default function Pencere({ title, onClose, tools, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal?.();
    const before = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = before; };
  }, []);

  return (
    <dialog
      ref={ref}
      className="tsp"
      aria-label={title}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      // Dışındaki karartıya dokununca kapanır.
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="tsp-box">
        <header className="tsp-head">
          <h2 className="h3">{title}</h2>
          <button type="button" className="tsp-close" onClick={onClose} aria-label="Kapat"><CloseIcon size={22} /></button>
        </header>
        {tools && <div className="tsp-tools">{tools}</div>}
        <div className="tsp-body">{children}</div>
      </div>
    </dialog>
  );
}
