/** Teslimat adresi: liste verisi, arama, doğrulama, gizlilik ve kargo etiketi. */
import fs from 'fs';
import path from 'path';
import { filterOptions, formatAddress, placeName, searchKey } from '@/lib/address';
import {
  OrderRequestSchema, contactErrors, customerView, parseOrderInput, shippingLabel,
} from '@/lib/siparis-types';

const contact = {
  name: 'Ali Veli', phone: '0555 111 22 33',
  city: 'İzmir', district: 'Bornova', neighborhood: 'Kazımdirik Mahallesi', street: '372. Sokak',
  buildingNo: '12', doorNo: '4', postalCode: '35100',
};
const input = (extra: Record<string, unknown> = {}) => ({
  items: [{ productId: 'p1', qty: 1, photoCount: 0, hasPreview: false }], kvkk: true, ...contact, ...extra,
});
const message = (extra: Record<string, unknown>) => parseOrderInput(input(extra)).error?.issues[0].message;

describe('liste verisi', () => {
  const read = (file: string) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/adres', file), 'utf8'));
  const provinces = read('iller.json');

  it('81 il ve her il için mahalle dosyası vardır', () => {
    expect(provinces).toHaveLength(81);
    for (const p of provinces) {
      const places = read(`mahalle/${p.id}.json`);
      for (const d of p.ilceler) expect(places[d.id].length).toBeGreaterThan(0);
    }
  });

  it('Bornova mahalleleri posta koduyla gelir', () => {
    const izmir = provinces.find((p: { ad: string }) => p.ad === 'İzmir');
    const bornova = izmir.ilceler.find((d: { ad: string }) => d.ad === 'Bornova');
    const rows = read(`mahalle/${izmir.id}.json`)[bornova.id];
    expect(rows.find((r: [string]) => r[0] === 'Kazımdirik')[1]).toMatch(/^35\d{3}$/);
  });
});

describe('arama', () => {
  const options = ['Şişli', 'Beşiktaş', 'Ataşehir', 'Esenyurt'].map((label) => ({ label }));

  it('Türkçe harfsiz yazılan arama eşleşir', () => {
    expect(searchKey('  ŞİŞLİ ')).toBe('sisli');
    expect(filterOptions(options, 'sisli').map((o) => o.label)).toEqual(['Şişli']);
  });

  it('baştan eşleşenler önce gelir', () => {
    expect(filterOptions(options, 'es').map((o) => o.label)).toEqual(['Esenyurt', 'Beşiktaş']);
  });

  it('boş aramada hepsi döner', () => {
    expect(filterOptions(options, '')).toHaveLength(4);
  });
});

describe('adres satırı', () => {
  it('kargo etiketi sırasıyla yazılır', () => {
    expect(formatAddress(contact)).toBe('Kazımdirik Mahallesi, 372. Sokak No: 12 Daire: 4, 35100 Bornova / İzmir');
    expect(formatAddress({ city: 'İzmir' })).toBe('İzmir');
    expect(placeName(['Akdurak', '02320', 1])).toBe('Akdurak Köyü');
  });
});

describe('sipariş doğrulaması', () => {
  it('tam adresle kabul edilir; daire no ve tarif isteğe bağlıdır', () => {
    expect(parseOrderInput(input()).success).toBe(true);
    expect(parseOrderInput(input({ doorNo: undefined, directions: 'Bakkalın üstü' })).success).toBe(true);
  });

  it.each([
    ['city', 'İl seçin'], ['district', 'İlçe seçin'], ['neighborhood', 'Mahalle ya da köy seçin'],
    ['street', 'Cadde ya da sokak yazın'], ['buildingNo', 'Bina numarasını yazın'], ['postalCode', 'Posta kodu 5 haneli olmalı'],
  ])('%s eksikse reddedilir', (field, text) => {
    for (const value of [undefined, '', '  ']) expect(message({ [field]: value })).toBe(text);
  });

  it('posta kodu 5 rakam olmalı', () => {
    expect(message({ postalCode: '3510' })).toBe('Posta kodu 5 haneli olmalı');
    expect(message({ postalCode: '35A00' })).toBe('Posta kodu 5 haneli olmalı');
  });

  it('başka alıcı ve kurumsal fatura seçilirse alanları zorunludur', () => {
    expect(message({ recipient: { name: '', phone: '' } })).toContain('Teslim alacak');
    expect(message({ invoice: { company: 'Acme', taxOffice: 'Bornova', taxNo: '12' } })).toBe('Vergi numarası 10 ya da 11 haneli olmalı');
    expect(parseOrderInput(input({ recipient: { name: 'Ayşe Kaya', phone: '0532 000 00 00' }, invoice: { company: 'Acme Ltd', taxOffice: 'Bornova', taxNo: '1234567890' } })).success).toBe(true);
  });

  it('form uyarıları alan adıyla döner', () => {
    expect(contactErrors(contact)).toEqual({});
    const errors = contactErrors({ ...contact, name: '', street: '', recipient: { name: '', phone: '1' } });
    expect(Object.keys(errors).sort()).toEqual(['name', 'recipientName', 'recipientPhone', 'street']);
  });
});

describe('gizlilik ve kargo etiketi', () => {
  const order = OrderRequestSchema.parse({
    token: 'a'.repeat(32), createdAt: 1, updatedAt: 1, status: 'yeni', items: [], total: 0, ...contact,
    address: formatAddress(contact), directions: 'Mavi kapı', recipient: { name: 'Ayşe Kaya', phone: '0532 000 00 00' },
    invoice: { company: 'Acme Ltd', taxOffice: 'Bornova', taxNo: '1234567890' },
  });

  it('müşteri sayfasına açık adres, alıcı ve fatura bilgisi gitmez', () => {
    const dump = JSON.stringify(customerView(order));
    for (const secret of ['Kazımdirik', '372. Sokak', '35100', 'Mavi kapı', 'Ayşe', '0532', 'Acme', '1234567890']) expect(dump).not.toContain(secret);
    expect(dump).toContain('Bornova');
  });

  it('kargo etiketinde alıcı, telefon, adres ve tarif vardır', () => {
    expect(shippingLabel(order)).toBe(`Ayşe Kaya\n0532 000 00 00\n${formatAddress(contact)}\nTarif: Mavi kapı`);
    expect(shippingLabel({ ...order, recipient: undefined, directions: undefined })).toBe(`Ali Veli\n0555 111 22 33\n${formatAddress(contact)}`);
  });
});
