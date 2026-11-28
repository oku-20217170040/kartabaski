// Kupanın bir yüzündeki baskı katmanları: tipler, sınırlar ve saf işlemler (istemci + sunucu).
// Ölçüler baskı alanına oranlıdır; ekran, sepet ve 2400 px baskı dosyası aynı değerlerle çizer.
import { z } from 'zod';

export const MAX_LAYERS = 30;
export const MAX_LAYER_TEXT = 120;
export const MAX_PATTERN_TEXT = 40;
export const MAX_TEXT_LINES = 5;
/** Sipariş satırındaki yazı özeti (bütün yazı katmanları birleşik). */
export const MAX_SUMMARY = 800;

export const PHOTO_SHAPES = ['plain', 'rounded', 'circle', 'heart', 'star', 'hexagon', 'soft'] as const;
export const PHOTO_FILTERS = ['none', 'bw', 'sepia', 'vivid', 'warm', 'cool', 'fade'] as const;
export const TEXT_EFFECTS = ['none', 'outline', 'shadow'] as const;
export const SHAPE_SETS = ['ph', 'fl'] as const;

export type PhotoShape = (typeof PHOTO_SHAPES)[number];
export type PhotoFilter = (typeof PHOTO_FILTERS)[number];
export type TextEffect = (typeof TEXT_EFFECTS)[number];
export type ShapeSet = (typeof SHAPE_SETS)[number];

const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const fontId = z.string().regex(/^[a-z0-9-]{1,60}$/);
const shapeName = z.string().regex(/^[a-z0-9-]{1,80}$/);

const base = {
  id: z.string().regex(/^[A-Za-z0-9-]{1,40}$/),
  /** Merkez; 0–1 arası baskı alanının içi. */
  x: z.number().min(-1).max(2),
  y: z.number().min(-1).max(2),
  /** Yazıda harf boyu, süste kenar, desende karo (yüksekliğe oran); fotoğrafta sığdırma katı. */
  s: z.number().min(0.01).max(6),
  /** Derece. */
  r: z.number().min(-180).max(180),
};

export const TextLayerSchema = z.object({
  ...base,
  kind: z.literal('text'),
  text: z.string().max(MAX_LAYER_TEXT),
  font: fontId,
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  color,
  /** -100 (aşağı yay) … 100 (yukarı yay). */
  curve: z.number().min(-100).max(100).optional(),
  fx: z.enum(TEXT_EFFECTS).optional(),
  fxColor: color.optional(),
  /** En fazla genişlik (alana oran); eski siparişten dönen yazıda kullanılır. */
  mw: z.number().min(0.1).max(1).optional(),
});

export const PhotoLayerSchema = z.object({
  ...base,
  kind: z.literal('photo'),
  /** Yüzün fotoğraf sırası; -1 seçilen hazır desen. */
  n: z.number().int().min(-1).max(7),
  shape: z.enum(PHOTO_SHAPES),
  filter: z.enum(PHOTO_FILTERS),
  /** Arka planı silinsin. */
  cut: z.boolean().optional(),
  /** Kırpma oranı (genişlik / yükseklik). */
  crop: z.number().min(0.2).max(5).optional(),
  /** Sığdırma kutusunun yüksekliği (eski yerleşim). */
  box: z.number().min(0.2).max(1).optional(),
  border: color.optional(),
});

export const ShapeLayerSchema = z.object({
  ...base,
  kind: z.literal('shape'),
  set: z.enum(SHAPE_SETS),
  name: shapeName,
  color,
});

export const PatternLayerSchema = z.object({
  ...base,
  kind: z.literal('pattern'),
  text: z.string().max(MAX_PATTERN_TEXT).optional(),
  set: z.enum(SHAPE_SETS).optional(),
  name: shapeName.optional(),
  font: fontId,
  bold: z.boolean().optional(),
  color,
  opacity: z.number().min(0.1).max(1),
});

export const LayerSchema = z.discriminatedUnion('kind', [TextLayerSchema, PhotoLayerSchema, ShapeLayerSchema, PatternLayerSchema]);
export const LayersSchema = z.array(LayerSchema).max(MAX_LAYERS);

export type TextLayer = z.infer<typeof TextLayerSchema>;
export type PhotoLayer = z.infer<typeof PhotoLayerSchema>;
export type ShapeLayer = z.infer<typeof ShapeLayerSchema>;
export type PatternLayer = z.infer<typeof PatternLayerSchema>;
export type Layer = z.infer<typeof LayerSchema>;
export type LayerKind = Layer['kind'];

/** Bozuk katman atılır, kalanlar korunur (eski ya da elle değişmiş sepet). */
export function parseLayers(input: unknown): Layer[] | undefined {
  if (!Array.isArray(input)) return undefined;
  return input.flatMap((x) => {
    const r = LayerSchema.safeParse(x);
    return r.success ? [r.data] : [];
  }).slice(0, MAX_LAYERS);
}

export const newLayerId = () => `k${Math.random().toString(36).slice(2, 10)}`;

export const DEFAULT_FONT = 'duz';
export const DEFAULT_INK = '#17171A';

export const textLayer = (patch: Partial<TextLayer> = {}): TextLayer => ({
  kind: 'text', id: newLayerId(), x: 0.5, y: 0.5, s: 0.18, r: 0, text: 'Yazınız', font: DEFAULT_FONT, color: DEFAULT_INK, ...patch,
});

export const photoLayer = (n: number, patch: Partial<PhotoLayer> = {}): PhotoLayer => ({
  kind: 'photo', id: newLayerId(), x: 0.5, y: 0.5, s: 1, r: 0, n, shape: 'plain', filter: 'none', ...patch,
});

export const shapeLayer = (set: ShapeSet, name: string, patch: Partial<ShapeLayer> = {}): ShapeLayer => ({
  kind: 'shape', id: newLayerId(), x: 0.5, y: 0.5, s: 0.32, r: 0, set, name, color: DEFAULT_INK, ...patch,
});

export const patternLayer = (patch: Partial<PatternLayer> = {}): PatternLayer => ({
  kind: 'pattern', id: newLayerId(), x: 0.5, y: 0.5, s: 0.26, r: -15, font: DEFAULT_FONT, color: DEFAULT_INK, opacity: 0.35, ...patch,
});

/** Desen her zaman en alttadır; diğerleri üste eklenir. */
export function addLayer(layers: Layer[], layer: Layer): Layer[] {
  if (layers.length >= MAX_LAYERS) return layers;
  return layer.kind === 'pattern' ? [layer, ...layers.filter((l) => l.kind !== 'pattern')] : [...layers, layer];
}

export const updateLayer = (layers: Layer[], id: string, patch: Partial<Layer>): Layer[] =>
  layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l));

export const removeLayer = (layers: Layer[], id: string): Layer[] => layers.filter((l) => l.id !== id);

export function duplicateLayer(layers: Layer[], id: string): { layers: Layer[]; id: string | null } {
  const at = layers.findIndex((l) => l.id === id);
  const found = layers[at];
  if (!found || found.kind === 'pattern' || layers.length >= MAX_LAYERS) return { layers, id: null };
  const copy = { ...found, id: newLayerId(), x: Math.min(0.95, found.x + 0.05), y: Math.min(0.95, found.y + 0.08) };
  return { layers: [...layers.slice(0, at + 1), copy, ...layers.slice(at + 1)], id: copy.id };
}

/** Katmanı bir sıra öne (`1`) ya da arkaya (`-1`) alır; desen yerinde kalır. */
export function moveLayer(layers: Layer[], id: string, step: 1 | -1): Layer[] {
  const at = layers.findIndex((l) => l.id === id);
  const to = at + step;
  if (at < 0 || to < 0 || to >= layers.length || layers[at].kind === 'pattern' || layers[to].kind === 'pattern') return layers;
  const next = [...layers];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}

/** Fotoğraf silinince katmanı da gider, sonraki fotoğrafların sırası kayar. */
export function removePhotoAt(layers: Layer[], n: number): Layer[] {
  return layers
    .filter((l) => !(l.kind === 'photo' && l.n === n))
    .map((l) => (l.kind === 'photo' && l.n > n ? { ...l, n: l.n - 1 } : l));
}

/** Listede ve sipariş özetinde görünen yazılar. */
export function layersText(layers: Layer[]): string {
  return layers
    .flatMap((l) => (l.kind === 'text' || l.kind === 'pattern' ? [(l.text ?? '').replace(/\s+/g, ' ').trim()] : []))
    .filter(Boolean)
    .join(' / ')
    .slice(0, MAX_SUMMARY);
}

/** Boş yazı ve içeriksiz desen sepete girmez. */
export const printableLayers = (layers: Layer[]): Layer[] =>
  layers.filter((l) => (l.kind === 'text' ? Boolean(l.text.trim()) : l.kind === 'pattern' ? Boolean(l.text?.trim() || l.name) : true));

export const countShapes = (layers: Layer[] = []) => layers.filter((l) => l.kind === 'shape').length;
export const wantsCut = (layers: Layer[] = []) => layers.some((l) => l.kind === 'photo' && l.cut);
