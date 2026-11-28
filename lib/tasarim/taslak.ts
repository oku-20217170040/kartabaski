// Yarım kalan tasarımın cihazda saklanması: katmanlar localStorage'da, fotoğraflar IndexedDB'de.
import type { ReadyDesign } from '../cart-types';
import { Layer, parseLayers } from './model';

const PREFIX = 'kartabaski-tasarim:';
export const DRAFT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const FILE_ID = /^[A-Za-z0-9-]{1,64}$/;

export interface DraftSide { layers: Layer[]; photos: string[]; ready?: ReadyDesign }

export interface SavedDesign {
  at: number;
  color: string;
  qty: number;
  twoSided: boolean;
  needsDesign: boolean;
  note: string;
  front: DraftSide;
  back: DraftSide;
}

function parseSide(x: unknown): DraftSide {
  const d = (x && typeof x === 'object' ? x : {}) as Record<string, unknown>;
  const r = d.ready as ReadyDesign | undefined;
  return {
    layers: parseLayers(d.layers) ?? [],
    photos: Array.isArray(d.photos) ? d.photos.filter((p): p is string => typeof p === 'string' && FILE_ID.test(p)).slice(0, 8) : [],
    ready: r && typeof r.id === 'string' && typeof r.name === 'string' ? r : undefined,
  };
}

export function parseDraft(raw: string | null, now = Date.now()): SavedDesign | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (typeof d.at !== 'number' || now - d.at > DRAFT_TTL_MS) return null;
    return {
      at: d.at,
      color: typeof d.color === 'string' ? d.color.slice(0, 60) : '',
      qty: typeof d.qty === 'number' && d.qty >= 1 ? Math.floor(d.qty) : 1,
      twoSided: d.twoSided === true,
      needsDesign: d.needsDesign === true,
      note: typeof d.note === 'string' ? d.note : '',
      front: parseSide(d.front),
      back: parseSide(d.back),
    };
  } catch {
    return null;
  }
}

export function loadSavedDesign(slug: string): SavedDesign | null {
  try { return parseDraft(window.localStorage.getItem(PREFIX + slug)); } catch { return null; }
}

export function storeDesign(slug: string, design: SavedDesign) {
  try { window.localStorage.setItem(PREFIX + slug, JSON.stringify(design)); } catch { /* depolama kapalı */ }
}

export function clearSavedDesign(slug: string) {
  try { window.localStorage.removeItem(PREFIX + slug); } catch { /* depolama kapalı */ }
}
