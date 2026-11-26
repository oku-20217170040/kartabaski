/**
 * Adres listelerini sitede sunulacak küçük dosyalara çevirir.
 *
 * Kaynak: turkiye-api (MIT), https://api.turkiyeapi.dev/v2/datasets/<yıl>/
 *   provinces.json, districts.json, neighborhoods.json, villages.json
 * Kullanım: node tools/adres-verisi.mjs <indirilen-dosyalarin-klasoru> <veri-yili>
 * Çıktı: public/adres/iller.json ve public/adres/mahalle/<il>.json
 */
import fs from 'fs';
import path from 'path';

const [dir, year] = process.argv.slice(2);
if (!dir || !year) throw new Error('Kullanım: node tools/adres-verisi.mjs <klasör> <yıl>');

const read = (name) => {
  const data = JSON.parse(fs.readFileSync(path.join(dir, `${name}.json`), 'utf8'));
  if (!Array.isArray(data) || !data.length) throw new Error(`${name}.json beklenen biçimde değil`);
  return data;
};
const text = (value) => {
  const s = String(value ?? '').trim();
  if (!s || s.length > 80 || /[<>{}\\]/.test(s)) throw new Error(`Beklenmeyen ad: ${JSON.stringify(value)}`);
  return s;
};
const postal = (value) => (/^\d{5}$/.test(String(value ?? '')) ? String(value) : '');
const tr = new Intl.Collator('tr');
const byName = (a, b) => tr.compare(a[0], b[0]);

const provinces = read('provinces');
const districts = read('districts');
const places = [...read('neighborhoods').map((p) => [p, 0]), ...read('villages').map((p) => [p, 1])];
if (provinces.length !== 81 || districts.length < 900) throw new Error('İl ya da ilçe sayısı beklenenden farklı');

const out = path.join('public', 'adres');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'mahalle'), { recursive: true });

const list = provinces
  .map((p) => ({
    id: Number(p.id),
    ad: text(p.name),
    ilceler: districts.filter((d) => d.provinceId === p.id).map((d) => [text(d.name), Number(d.id)]).sort(byName).map(([ad, id]) => ({ id, ad })),
  }))
  .sort((a, b) => tr.compare(a.ad, b.ad));
fs.writeFileSync(path.join(out, 'iller.json'), JSON.stringify(list));

let count = 0;
for (const province of list) {
  const byDistrict = {};
  for (const district of province.ilceler) {
    const rows = places
      .filter(([p]) => p.districtId === district.id)
      .map(([p, village]) => [text(p.name), postal(p.postalCode), village])
      .sort(byName);
    byDistrict[district.id] = rows;
    count += rows.length;
  }
  fs.writeFileSync(path.join(out, 'mahalle', `${province.id}.json`), JSON.stringify(byDistrict));
}
if (count !== places.length) throw new Error(`Yer sayısı tutmuyor: ${count} / ${places.length}`);

fs.writeFileSync(path.join(out, 'KAYNAK.txt'), `Adres listesi: turkiye-api (https://github.com/ubeydeozdmr/turkiye-api), MIT lisansı.
Veri yılı: ${year}. Posta kodları PTT verisine dayanır.
Yeniden üretmek için: tools/adres-verisi.mjs

MIT License
Copyright (c) turkiye-api contributors
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above
copyright notice and this permission notice shall be included in all copies or substantial portions of the
Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
`);
console.log(`il ${list.length}, ilçe ${list.reduce((s, p) => s + p.ilceler.length, 0)}, mahalle ve köy ${count}`);
