'use server';

import { requireAdmin } from './require-admin';
import { countNewDesigns, deleteDesign, getDesign, listDesigns, setDesignAdmin } from './designs';
import { Design, DESIGN_TOKEN_RE } from './design-types';
import { isTalepStatus } from './talep-status';

function assertToken(token: string) {
  if (!DESIGN_TOKEN_RE.test(token)) throw new Error('Geçersiz sipariş');
}

export async function countNewDesignsAction(): Promise<number> {
  await requireAdmin();
  return countNewDesigns();
}

export async function listDesignsAction(): Promise<Design[]> {
  await requireAdmin();
  return listDesigns();
}

export async function getDesignAction(token: string): Promise<Design | null> {
  await requireAdmin();
  return getDesign(token);
}

export async function updateDesignStatusAction(token: string, status: string): Promise<void> {
  await requireAdmin();
  assertToken(token);
  if (!isTalepStatus(status)) throw new Error('Geçersiz durum');
  await setDesignAdmin(token, { status });
}

export async function updateDesignAdminNoteAction(token: string, note: string): Promise<void> {
  await requireAdmin();
  assertToken(token);
  await setDesignAdmin(token, { adminNote: String(note ?? '').slice(0, 1000) });
}

export async function deleteDesignAction(token: string): Promise<void> {
  await requireAdmin();
  assertToken(token);
  await deleteDesign(token);
}
