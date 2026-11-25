import 'server-only';
import type { ImageProvider, ImageProviderId } from './types';
import { cloudflareProvider } from './providers/cloudflare';
import { huggingfaceProvider } from './providers/huggingface';
import { geminiProvider } from './providers/gemini';
import { falProvider } from './providers/fal';
import { openaiProvider } from './providers/openai';
import { replicateProvider } from './providers/replicate';
import { mockProvider } from './providers/mock';

export const PROVIDERS: ImageProvider[] = [
  cloudflareProvider,
  huggingfaceProvider,
  geminiProvider,
  falProvider,
  openaiProvider,
  replicateProvider,
  mockProvider,
];

export function getProvider(id: ImageProviderId): ImageProvider | undefined {
  return PROVIDERS.find((p) => p.id === id);
}

export function listProviders(): {
  id: ImageProviderId;
  label: string;
  configured: boolean;
  missingEnv: string[];
  defaultModel: string;
  free: boolean;
}[] {
  return PROVIDERS.map((p) => ({
    id: p.id,
    label: p.label,
    configured: p.configured(),
    missingEnv: p.missingEnv(),
    defaultModel: p.defaultModel,
    free: !!p.free,
  }));
}

/** Tercih yapılandırılmışsa o; değilse ilk yapılandırılmış sağlayıcı; hiçbiri yoksa null. */
export function pickProvider(preferred?: ImageProviderId): ImageProvider | null {
  if (preferred) {
    const p = getProvider(preferred);
    if (p?.configured()) return p;
  }
  return PROVIDERS.find((p) => p.configured()) ?? null;
}
