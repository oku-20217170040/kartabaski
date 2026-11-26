// Yönetim paneli menüsü: saf kurallar (testli). İkonlar layout'ta `icon` anahtarıyla eşlenir.

export type AdminIconKey =
  | 'dashboard' | 'chart' | 'wallet' | 'box' | 'palette' | 'cog' | 'sparkles'
  | 'cart' | 'message' | 'megaphone' | 'pen' | 'globe'
  | 'instagram' | 'facebook' | 'threads' | 'telegram' | 'pinterest' | 'tiktok';

export interface AdminLink {
  href: string;
  label: string;
  icon: AdminIconKey;
  desc?: string;
  exact?: boolean;
  /** Sosyal medya grubu: aktiflik inSocial(pathname) ile belirlenir. */
  socialGroup?: boolean;
}

export interface AdminGroup { id: string; title: string; items: AdminLink[] }

export const ADMIN_GROUPS: AdminGroup[] = [
  {
    id: 'overview',
    title: 'Genel & Analiz',
    items: [
      { href: '/admin', label: 'Genel Bakış', icon: 'dashboard', desc: 'Özet göstergeler, grafikler ve hızlı işlemler', exact: true },
      { href: '/admin/istatistik', label: 'İstatistikler', icon: 'chart', desc: 'Ziyaretçi trafiği ve Google Arama verileri' },
      { href: '/admin/muhasebe', label: 'Muhasebe', icon: 'wallet', desc: 'Ciro, kâr, giderler ve satış defteri' },
    ],
  },
  {
    id: 'catalog',
    title: 'Katalog & Üretim',
    items: [
      { href: '/admin/products', label: 'Ürünler', icon: 'box', desc: 'Kupa kataloğu, fiyatlar ve görseller' },
      { href: '/admin/konfigurator', label: 'Konfiguratör', icon: 'palette', desc: 'Kupa ve tasarım seçenekleri' },
      { href: '/admin/makine', label: 'Makine', icon: 'cog', desc: 'Sipariş → baskı → kargo hattı ve haftalık rapor' },
      { href: '/admin/studio', label: 'Ürün Fotoğrafları', icon: 'sparkles', desc: 'Ürün eklenince stüdyo çekimi fotoğraflar üreten otomasyon' },
    ],
  },
  {
    id: 'customers',
    title: 'Müşteri',
    items: [
      { href: '/admin/siparisler', label: 'Siparişler', icon: 'cart', desc: 'Sepetten gelen siparişler ve tasarımları' },
      { href: '/admin/yorumlar', label: 'Yorumlar', icon: 'message', desc: 'Müşteri yorumları ve davet bağlantıları' },
    ],
  },
  {
    id: 'marketing',
    title: 'Pazarlama & İçerik',
    items: [
      { href: '/admin/sosyal-medya', label: 'Sosyal Medya', icon: 'megaphone', desc: '6 platform otomasyon merkezi', socialGroup: true },
      { href: '/admin/blog', label: 'Blog', icon: 'pen', desc: 'Blog yazıları ve otomatik yayın takvimi' },
      { href: '/admin/seo', label: 'SEO', icon: 'globe', desc: 'Anahtar kelimeler, meta ve Search Console' },
    ],
  },
];

export const SOCIAL_LINKS: AdminLink[] = [
  { href: '/admin/sosyal-medya', label: 'Merkez', icon: 'megaphone', desc: 'Otomasyon akışı ve toplu çalıştırma', exact: true },
  { href: '/admin/sosyal-medya/paylas', label: 'Hızlı Paylaşım', icon: 'sparkles', desc: 'Fotoğraf yükle ve tüm platformlarda yayınla' },
  { href: '/admin/instagram', label: 'Instagram', icon: 'instagram', desc: 'Gönderi ve hikâye planı' },
  { href: '/admin/facebook', label: 'Facebook', icon: 'facebook', desc: 'Sayfa paylaşımları' },
  { href: '/admin/threads', label: 'Threads', icon: 'threads', desc: 'Gönderiler' },
  { href: '/admin/telegram', label: 'Telegram', icon: 'telegram', desc: 'Kanal akışı' },
  { href: '/admin/pinterest', label: 'Pinterest', icon: 'pinterest', desc: 'Kategori panolarına pinler' },
  { href: '/admin/tiktok', label: 'TikTok', icon: 'tiktok', desc: 'Fotoğraf gönderileri' },
];

export const ADMIN_LINKS: AdminLink[] = ADMIN_GROUPS.flatMap((g) => g.items).filter((l) => !l.socialGroup);

export function isLinkActive(path: string, l: { href: string; exact?: boolean }): boolean {
  return l.exact ? path === l.href : path === l.href || path.startsWith(l.href + '/');
}

export const inSocial = (path: string): boolean => SOCIAL_LINKS.some((l) => isLinkActive(path, l));

/** Yan menüde anlık arama (Türkçe duyarlı). */
export function filterAdminLinks(query: string): AdminLink[] {
  const q = query.trim().toLocaleLowerCase('tr-TR');
  if (!q) return [];
  const seen = new Set<string>();
  const out: AdminLink[] = [];
  for (const item of [...ADMIN_GROUPS.flatMap((g) => g.items), ...SOCIAL_LINKS]) {
    if (seen.has(item.href)) continue;
    const hay = `${item.label} ${item.desc ?? ''} ${item.href}`.toLocaleLowerCase('tr-TR');
    if (hay.includes(q)) { seen.add(item.href); out.push(item); }
  }
  return out;
}

/** Mobil üst başlık: en uzun eşleşen bağlantının adı. */
export function adminPageTitle(path: string): string {
  let best: AdminLink | null = null;
  for (const l of [...ADMIN_LINKS, ...SOCIAL_LINKS]) {
    if (!isLinkActive(path, l)) continue;
    if (!best || l.href.length > best.href.length) best = l;
  }
  return best ? best.label : 'Yönetim';
}
