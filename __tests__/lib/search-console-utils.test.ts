import { generateKeyPairSync, createVerify } from 'crypto';
import {
  buildJwtAssertion, gscDateRange, pickSite, mapRows, fmtCtr, fmtPos, explainGscError, GSC_SCOPE, GOOGLE_TOKEN_URL,
} from '@/lib/search-console-utils';

describe('buildJwtAssertion', () => {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const jwt = buildJwtAssertion({ email: 'sa@proje.iam.gserviceaccount.com', privateKey, scope: GSC_SCOPE, nowSec: 1_800_000_000 });
  const [h, c, s] = jwt.split('.');
  const dec = (x: string) => JSON.parse(Buffer.from(x.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));

  it('başlık ve talepler doğru', () => {
    expect(dec(h)).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(dec(c)).toEqual({ iss: 'sa@proje.iam.gserviceaccount.com', scope: GSC_SCOPE, aud: GOOGLE_TOKEN_URL, iat: 1_800_000_000, exp: 1_800_003_600 });
  });

  it('imza açık anahtarla doğrulanır; üç parça ve dolgu karakteri yok', () => {
    expect(jwt.split('.')).toHaveLength(3);
    expect(jwt).not.toMatch(/[=+/]/);
    const v = createVerify('RSA-SHA256');
    v.update(`${h}.${c}`);
    expect(v.verify(publicKey, Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64'))).toBe(true);
  });
});

describe('gscDateRange', () => {
  it('bitişi gecikme kadar geriden alır, aralık tam n gün olur', () => {
    expect(gscDateRange(28, '2026-11-01')).toEqual({ startDate: '2026-10-03', endDate: '2026-10-30' });
    expect(gscDateRange(1, '2026-11-01')).toEqual({ startDate: '2026-10-30', endDate: '2026-10-30' });
  });
  it('ay/yıl sınırını doğru geçer, gün sayısını sınırlar', () => {
    expect(gscDateRange(7, '2027-01-02')).toEqual({ startDate: '2026-12-25', endDate: '2026-12-31' });
    expect(gscDateRange(10_000, '2026-11-01').startDate < '2025-08-01').toBe(true);
    expect(gscDateRange(0, '2026-11-01')).toEqual({ startDate: '2026-10-30', endDate: '2026-10-30' });
  });
});

describe('pickSite', () => {
  it('alan adı mülkünü öne alır', () => {
    const sites = [{ siteUrl: 'https://www.kartabaski.com/', permissionLevel: 'siteOwner' }, { siteUrl: 'sc-domain:kartabaski.com', permissionLevel: 'siteRestrictedUser' }];
    expect(pickSite(sites)).toBe('sc-domain:kartabaski.com');
  });
  it('doğrulanmamış kullanıcı ve başka siteleri atlar', () => {
    expect(pickSite([{ siteUrl: 'sc-domain:kartabaski.com', permissionLevel: 'siteUnverifiedUser' }])).toBeNull();
    expect(pickSite([{ siteUrl: 'sc-domain:baska.com', permissionLevel: 'siteOwner' }])).toBeNull();
    expect(pickSite([])).toBeNull();
  });
  it('listedeki herhangi bir kartabaski mülkünü yedek olarak alır', () => {
    expect(pickSite([{ siteUrl: 'https://www.kartabaski.com/blog/', permissionLevel: 'siteFullUser' }])).toBe('https://www.kartabaski.com/blog/');
  });
});

describe('mapRows ve biçimleme', () => {
  it('bozuk veriye dayanıklı', () => {
    expect(mapRows(undefined)).toEqual([]);
    expect(mapRows([{ keys: ['ikinci el koltuk'], clicks: 5, impressions: 100, ctr: 0.05, position: 7.34 }, {}]))
      .toEqual([{ key: 'ikinci el koltuk', clicks: 5, impressions: 100, ctr: 0.05, position: 7.34 }, { key: '', clicks: 0, impressions: 0, ctr: 0, position: 0 }]);
  });
  it('yüzde ve sıra Türkçe virgülle biçimlenir', () => {
    expect(fmtCtr(0.0537)).toBe('5,4%');
    expect(fmtPos(7.34)).toBe('7,3');
  });
});

describe('explainGscError', () => {
  const email = 'sa@x.iam.gserviceaccount.com';
  it('API kapalıysa etkinleştirme ipucu verir', () => {
    expect(explainGscError(403, 'Google Search Console API has not been used in project 1 before or it is disabled', email)).toContain('API');
  });
  it('yetki yoksa hizmet hesabını ekleme ipucu verir', () => {
    expect(explainGscError(403, 'User does not have sufficient permission for site', email)).toContain(email);
  });
  it('diğer hatalarda mesajı kısaltarak döndürür', () => {
    expect(explainGscError(500, 'x'.repeat(500), email)).toHaveLength(200);
    expect(explainGscError(500, '', email)).toContain('500');
  });
});
