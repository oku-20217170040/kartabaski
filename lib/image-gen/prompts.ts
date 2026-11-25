// Saf: stüdyo sahneleri + "ürünü bozma" kuralları. server-only YOK.
import type { GenerateRequest } from './types';

export interface StudioScene {
  id: string;
  label: string;
  prompt: string;
  aspectRatio: GenerateRequest['aspectRatio'];
}

export const PRESERVE_RULES =
  'CRITICAL: Keep the exact same product from the reference image unchanged in shape, proportions, handle, rim, base, color, material, and surface appearance. ' +
  'Preserve the exact surface of the reference product as-is: if the reference surface is plain and blank, keep it completely plain and blank with zero text or graphics; if the reference surface already shows a printed artwork, photo, or lettering, keep that existing print identical without altering it. ' +
  'Do NOT add, invent, or overlay any new text, words, letters, logos, watermarks, or labels anywhere on the product or in the scene. ' +
  'Do NOT crop the product; keep the entire product fully visible in frame. Photorealistic commercial product photography, natural lighting, realistic shadows, sharp focus.';

export const STUDIO_SCENES: StudioScene[] = [
  {
    id: 'beyaz-fon',
    label: 'Beyaz sonsuz fon stüdyo',
    prompt:
      'Place the product on a seamless pure white infinity-cove studio background, soft even softbox lighting, subtle natural contact shadow, centered hero shot.',
    aspectRatio: '1:1',
  },
  {
    id: 'gri-gradyan',
    label: 'Açık gri gradyan fon + yumuşak gölge',
    prompt:
      'Place the product on a light grey gradient studio backdrop with a soft diffused shadow beneath it, clean minimalist composition, gentle rim light.',
    aspectRatio: '4:5',
  },
  {
    id: 'ahsap-masa',
    label: 'Ahşap masa üzerinde sabah kahvesi',
    prompt:
      'Place the product on a warm rustic wooden table in soft morning window light, filled with steaming coffee, a few coffee beans nearby, cozy blurred kitchen background.',
    aspectRatio: '4:5',
  },
  {
    id: 'mermer-tezgah',
    label: 'Mermer tezgâh',
    prompt:
      'Place the product on a white marble countertop with subtle grey veining, bright airy lighting, elegant minimal styling, softly blurred neutral background.',
    aspectRatio: '1:1',
  },
  {
    id: 'hediye-kutusu',
    label: 'Hediye kutusu + kurdele',
    prompt:
      'Present the product next to an open gift box with a satin ribbon and tissue paper, festive yet tasteful gift-ready composition, soft warm lighting.',
    aspectRatio: '4:5',
  },
  {
    id: 'ofis-masasi',
    label: 'Ofis masası (kurumsal)',
    prompt:
      'Place the product on a tidy modern office desk beside a laptop and notebook, professional corporate atmosphere, soft daylight, blurred office background.',
    aspectRatio: '16:9',
  },
  {
    id: 'elde-tutulan',
    label: 'Elde tutulan kupa',
    prompt:
      'A person holds the product in one hand, only the hand and forearm visible, no face, natural cozy setting with soft blurred background, product clearly facing the camera.',
    aspectRatio: '4:5',
  },
  {
    id: 'ozel-gun',
    label: 'Yılbaşı / özel gün (sade)',
    prompt:
      'Place the product on a table with a restrained festive touch: soft fairy-light bokeh, a small pine sprig and a simple ribbon, warm cozy tones, uncluttered.',
    aspectRatio: '4:5',
  },
  {
    id: 'yakin-detay',
    label: '45° yakın detay (baskıyı gösteren)',
    prompt:
      'Close-up shot at a 45 degree angle that clearly shows the printed design on the product, shallow depth of field, clean neutral studio background, crisp lighting on the print.',
    aspectRatio: '1:1',
  },
];

export const DEFAULT_SCENE_IDS: string[] = ['beyaz-fon', 'gri-gradyan', 'ahsap-masa', 'yakin-detay'];

const CATEGORY_OBJECT_HINT: Record<string, string> = {
  'Seramik Kahve Fincanı': 'ceramic coffee cup',
  'Kahve Fincanı': 'coffee cup',
  'Latte Fincanı': 'latte cup',
  'Sihirli Kupa': 'ceramic mug',
};

export function buildPrompt(
  scene: Pick<StudioScene, 'prompt'>,
  product: { title: string; category?: string; color?: string; extra?: string },
): string {
  // Türkçe ürün başlığını (örn. "Seramik Kahve Fincanı - Kişiye Özel Baskı") doğrudan veya tırnak içinde
  // göndermek, görsel modellerinin bu metni kupanın üzerine basılacak yazı sanmasına yol açar.
  const objectName = (product.category && CATEGORY_OBJECT_HINT[product.category]) || 'ceramic mug';
  const colorHint = product.color?.trim() ? ` (${product.color.trim()} color)` : '';
  return [
    `Keep the exact ${objectName}${colorHint} from the reference image completely unchanged, and change only the surrounding studio environment and lighting:`,
    scene.prompt,
    product.extra?.trim() || '',
    PRESERVE_RULES,
  ]
    .filter(Boolean)
    .join('\n\n');
}
