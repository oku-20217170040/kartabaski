import 'server-only';
import type { GenerateRequest, GenerateResult, ImageProvider } from '../types';
import { ImageGenError } from '../types';
import { fetchImage } from '../fetch-utils';

export const mockProvider: ImageProvider = {
  id: 'mock',
  label: 'Sahte (test)',
  defaultModel: 'mock',
  free: true,
  configured: () => process.env.IMAGE_GEN_MOCK === '1',
  missingEnv: () => (process.env.IMAGE_GEN_MOCK === '1' ? [] : ['IMAGE_GEN_MOCK']),
  async generate(req: GenerateRequest): Promise<GenerateResult> {
    const ref = req.referenceUrls[0];
    if (!ref) throw new ImageGenError('Referans görsel yok.', false);
    const { bytes, mimeType } = await fetchImage(ref, { label: 'Referans görsel' });
    return { images: [{ data: bytes, mimeType }], model: 'mock' };
  },
};
