// Kupa/fincan ürün fotoğrafları için hazır sahne önerileri (saf veri, testli).
// Etiket Türkçe, prompt Photoroom için İngilizce.
import type { PhotoroomMode } from './photoroom';

export interface StudioScene {
  id: string;
  label: string;
  hint: string;
  mode: PhotoroomMode;
  /** Photoroom `background.prompt` (İngilizce). clean_white için boş. */
  prompt: string;
}

export const STUDIO_SCENES: StudioScene[] = [
  {
    id: 'white-studio',
    label: 'Beyaz stüdyo',
    hint: 'Katalog görünümü: saf beyaz zemin, yumuşak gölge',
    mode: 'clean_white',
    prompt: '',
  },
  {
    id: 'wood-coffee',
    label: 'Ahşap masa + kahve',
    hint: 'Sıcak ahşap masa, yanında kahve çekirdekleri',
    mode: 'studio_staging',
    prompt:
      'warm rustic wooden table with scattered roasted coffee beans, soft morning window light, cozy cafe atmosphere, shallow depth of field',
  },
  {
    id: 'marble-counter',
    label: 'Mermer tezgâh',
    hint: 'Açık renk mermer yüzey, şık mutfak',
    mode: 'studio_staging',
    prompt: 'clean white marble kitchen countertop, bright soft daylight, minimalist elegant background, subtle reflections',
  },
  {
    id: 'gift-box',
    label: 'Hediye paketi',
    hint: 'Kurdele ve hediye kutusu ile doğum günü/hediye hissi',
    mode: 'studio_staging',
    prompt:
      'elegant gift wrapping scene with a ribbon and a small gift box beside, pastel tissue paper, soft studio lighting, festive gift presentation',
  },
  {
    id: 'office-desk',
    label: 'Ofis masası (kurumsal)',
    hint: 'Laptop ve not defteri olan modern ofis masası',
    mode: 'studio_staging',
    prompt:
      'modern office desk with a laptop and a notebook slightly out of focus, neutral light wood surface, professional corporate workspace, soft natural light',
  },
  {
    id: 'christmas',
    label: 'Yılbaşı',
    hint: 'Çam dalları, ışıklar, kırmızı-yeşil tonlar',
    mode: 'studio_staging',
    prompt:
      'cozy christmas scene with pine branches, warm fairy lights bokeh, red ornaments and a knitted blanket on a wooden table, festive atmosphere',
  },
  {
    id: 'valentines',
    label: 'Sevgililer günü',
    hint: 'Kırmızı güller, kalp detayları, romantik ışık',
    mode: 'studio_staging',
    prompt:
      'romantic valentines day scene with red rose petals and small hearts on a soft pink surface, warm candle light bokeh, dreamy atmosphere',
  },
  {
    id: 'mothers-day',
    label: 'Anneler günü',
    hint: 'Çiçek buketi, pastel tonlar',
    mode: 'studio_staging',
    prompt: 'fresh spring flower bouquet in pastel colors next to the product on a light linen tablecloth, soft natural daylight',
  },
  {
    id: 'magic-warm',
    label: 'Sihirli kupa ısınma efekti',
    hint: 'Sıcak içecek buharı, ısınınca açılan baskı hissi',
    mode: 'studio_staging',
    prompt:
      'dark moody kitchen counter, gentle steam rising, warm orange glow and soft light from the side suggesting a hot drink, magical atmosphere with subtle sparkles',
  },
  {
    id: 'portrait-bokeh',
    label: 'Bokeh portre (mevcut arka plan flu)',
    hint: 'Arka planı koruyup flulaştırır, ürün net kalır',
    mode: 'bokeh',
    prompt: '',
  },
];

export const DEFAULT_SCENE_ID = 'white-studio';

export function getScene(id: string | undefined | null): StudioScene | undefined {
  return STUDIO_SCENES.find((s) => s.id === id);
}

/** Sahne -> üretim seçenekleri (mod + prompt). */
export function sceneToOptions(scene: StudioScene): { mode: PhotoroomMode; prompt?: string; sceneId: string } {
  return { mode: scene.mode, ...(scene.prompt ? { prompt: scene.prompt } : {}), sceneId: scene.id };
}

export const MODE_LABEL: Record<PhotoroomMode, string> = {
  studio_staging: 'Sahne (arka plan + gölge)',
  clean_white: 'Temiz beyaz stüdyo',
  bokeh: 'Bokeh portre (arka plan flu)',
};
