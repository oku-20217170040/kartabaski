/** Sol menüdeki sekmeler (telefonda alt çubuk). */
export type Tab = 'kupa' | 'duzen' | 'yazi' | 'foto' | 'sus' | 'desen' | 'katman';

/** Seçili öğenin araçları. */
export type Tool =
  | 'metin' | 'font' | 'renk' | 'boyut' | 'dondur' | 'efekt' | 'kavis' | 'konum'
  | 'sekil' | 'filtre' | 'kirp' | 'kenarlik' | 'icerik' | 'siklik' | 'belirgin' | 'degistir';

export const TAB_TITLES: Record<Tab, string> = {
  kupa: 'Kupa', duzen: 'Hazır düzenler', yazi: 'Yazı', foto: 'Fotoğraflar', sus: 'Süsler', desen: 'Desen', katman: 'Katmanlar',
};

export const TOOL_TITLES: Record<Tool, string> = {
  metin: 'Yazınız', font: 'Yazı tipi', renk: 'Renk', boyut: 'Boyut', dondur: 'Döndür', efekt: 'Efekt', kavis: 'Kavis', konum: 'Konum',
  sekil: 'Şekil', filtre: 'Renk ayarı', kirp: 'Kırp', kenarlik: 'Kenarlık', icerik: 'Desenin içeriği', siklik: 'Sıklık', belirgin: 'Belirginlik', degistir: 'Süsü değiştir',
};
