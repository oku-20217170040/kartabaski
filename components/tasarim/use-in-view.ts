'use client';

import { useEffect, useState } from 'react';

/**
 * Öğe ekrana yaklaşınca `true`. `once` ise bir kez görülmesi yeter.
 * Dönen işlev `ref` olarak verilir; öğe sonradan eklense de izlenir.
 */
export function useInView<T extends Element>(once = true): [(node: T | null) => void, boolean] {
  const [node, setNode] = useState<T | null>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((e) => e.isIntersecting);
      if (visible) setSeen(true);
      else if (!once) setSeen(false);
      if (visible && once) observer.disconnect();
    }, { rootMargin: '160px' });
    observer.observe(node);
    return () => observer.disconnect();
  }, [node, once]);

  return [setNode, seen];
}
