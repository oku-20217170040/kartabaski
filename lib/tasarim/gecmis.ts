// Geri al / yinele.

export interface History<T> {
  past: T[];
  present: T;
  future: T[];
  /** Son değişikliğin türü ve zamanı: arka arkaya gelen aynı hareket tek adım sayılır. */
  tag?: string;
  at?: number;
}

export const HISTORY_LIMIT = 60;
export const MERGE_MS = 900;

export const startHistory = <T>(present: T): History<T> => ({ past: [], present, future: [] });

export function commit<T>(h: History<T>, next: T, tag?: string, now = Date.now()): History<T> {
  if (next === h.present) return h;
  const merge = Boolean(tag) && tag === h.tag && now - (h.at ?? 0) < MERGE_MS && h.past.length > 0;
  return {
    past: merge ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    tag,
    at: now,
  };
}

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] };
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  return { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) };
}
