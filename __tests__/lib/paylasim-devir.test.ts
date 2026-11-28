/** @jest-environment node */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/paylasim/depo', () => ({ yeniSistemAktif: jest.fn().mockResolvedValue(true) }));
jest.mock('@/lib/firebase-admin', () => ({ adminDb: { collection: () => ({ doc: () => ({}) }) }, adminAuth: {} }));

import { runTikTokCycle } from '@/lib/tiktok-auto';

it('yeni sistem açıkken eski TikTok turu ürün göndermez', async () => {
  await expect(runTikTokCycle()).resolves.toEqual({ posted: [], errors: [], skipped: 'ürün paylaşımları yeni paylaşım sisteminde' });
});
