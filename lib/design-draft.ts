// Konfigüratördeki seçimin tasarım ekranına taşınması (yalnız bu sekmede).
import type { ReadyDesign } from './cart-types';

const KEY = 'kartabaski-taslak';

export interface DesignDraft {
  slug: string;
  twoSided: boolean;
  front?: ReadyDesign;
  back?: ReadyDesign;
}

export function saveDraft(draft: DesignDraft) {
  try { sessionStorage.setItem(KEY, JSON.stringify(draft)); } catch { /* gizli mod: seçim taşınmaz */ }
}

/** Bu ürün için bekleyen taslağı bir kez verir. */
export function takeDraft(slug: string): DesignDraft | null {
  try {
    const draft = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as DesignDraft | null;
    if (draft?.slug !== slug) return null;
    sessionStorage.removeItem(KEY);
    return draft;
  } catch {
    return null;
  }
}
