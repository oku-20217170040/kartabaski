import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface SeoSettings {
  serviceAreas: string[];       // Hizmet bölgeleri
  services: string[];           // Yapılan işler
  keywords: string[];           // Anahtar kelimeler
  featuredCategories: string[]; // Öne çıkan kategoriler
  workingHours: string;         // Çalışma saatleri (serbest metin)
  extraDescription: string;     // Ek açıklama
}

export const DEFAULT_SEO: SeoSettings = {
  serviceAreas: ['Esenyurt', 'Beylikdüzü', 'Avcılar', 'Büyükçekmece', 'Bahçeşehir', 'Başakşehir'],
  services: ['İkinci el mobilya alım satım', 'Spot beyaz eşya', 'Nakliye ve taşımacılık', 'Aynı gün teslimat'],
  keywords: [],
  featuredCategories: ['Mobilya', 'Beyaz Eşya', 'Elektronik'],
  workingHours: 'Pazartesi-Pazar 09:00-00:00',
  extraDescription: '',
};

const DOC_PATH = 'seo_settings/main';

export async function getSeoSettings(): Promise<SeoSettings> {
  try {
    const snap = await getDoc(doc(db, 'seo_settings', 'main'));
    if (!snap.exists()) return DEFAULT_SEO;
    return { ...DEFAULT_SEO, ...snap.data() } as SeoSettings;
  } catch {
    return DEFAULT_SEO;
  }
}

export async function saveSeoSettings(data: SeoSettings): Promise<void> {
  await setDoc(doc(db, 'seo_settings', 'main'), data);
}
