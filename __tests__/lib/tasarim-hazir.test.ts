import { readFileSync } from 'fs';
import path from 'path';
import { PATTERN_STYLES, TEXT_BASICS, TEXT_STYLES, patternFrom } from '@/lib/tasarim/hazir-parcalar';
import { LayersSchema, textLayer } from '@/lib/tasarim/model';
import { isKnownFont } from '@/lib/tasarim/yazi-tipleri';
import { MUG_MODELS, swatchColor } from '@/lib/mug3d';

const icons = (pkg: string) => JSON.parse(readFileSync(path.join(process.cwd(), 'node_modules/@iconify-json', pkg, 'icons.json'), 'utf8')).icons as Record<string, unknown>;

describe('hazır yazı stilleri ve desenler', () => {
  it('stillerin yazı tipi listededir ve katmanları geçerlidir', () => {
    const layers = [...TEXT_STYLES, ...TEXT_BASICS].map((s) => textLayer({ text: s.text, ...s.patch }));
    expect(LayersSchema.safeParse(layers).success).toBe(true);
    for (const l of layers) expect([l.font, isKnownFont(l.font)]).toEqual([l.font, true]);
  });

  it('desenlerin süsü pakette vardır', () => {
    const ph = icons('ph');
    const fl = icons('fluent-emoji-flat');
    for (const style of PATTERN_STYLES) {
      const l = patternFrom(style);
      expect(LayersSchema.safeParse([l]).success).toBe(true);
      expect(isKnownFont(l.font)).toBe(true);
      if (l.name) expect([l.name, Boolean(l.set === 'ph' ? ph[`${l.name}-fill`] : fl[l.name])]).toEqual([l.name, true]);
    }
  });
});

describe('kupa rengi yuvarlağı', () => {
  it('katalogdaki adın rengini verir; bilinmeyen ad beyazdır', () => {
    expect(swatchColor(MUG_MODELS.luks, 'Beyaz')).toBe('#FFFFFF');
    expect(swatchColor(MUG_MODELS.luks, 'Lacivert')).not.toBe('#FFFFFF');
    expect(swatchColor(null, 'Kırmızı')).not.toBe('#FFFFFF');
    expect(swatchColor(null, 'Bilinmeyen')).toBe('#FFFFFF');
  });
});
