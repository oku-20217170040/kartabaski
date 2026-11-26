'use client';

import { useCallback, useEffect, useState } from 'react';
import { PlaceRow, Province, formatAddress, placeName } from '@/lib/address';
import type { ContactField, ContactForm } from '@/lib/siparis-types';
import PickerField from './PickerField';
import './address.css';

interface Props {
  form: ContactForm;
  onChange: (patch: Partial<ContactForm>) => void;
  /** Gönderme denendiyse gösterilecek uyarılar. */
  errors: Partial<Record<ContactField, string>>;
}

const json = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
};

/** Teslimat adresi, teslim alacak kişi ve kurumsal fatura alanları. */
export default function AddressFields({ form, onChange, errors }: Props) {
  const [provinces, setProvinces] = useState<Province[] | null>(null);
  const [places, setPlaces] = useState<{ province: number; byDistrict: Record<string, PlaceRow[]> } | null>(null);
  const [failed, setFailed] = useState(false);
  const [manual, setManual] = useState(false);

  const province = provinces?.find((p) => p.ad === form.city);
  const district = province?.ilceler.find((d) => d.ad === form.district);

  const loadProvinces = useCallback(() => {
    setFailed(false);
    json<Province[]>('/adres/iller.json').then(setProvinces).catch(() => setFailed(true));
  }, []);
  useEffect(() => { loadProvinces(); }, [loadProvinces]);

  const provinceId = province?.id;
  useEffect(() => {
    if (!provinceId) return;
    let alive = true;
    json<Record<string, PlaceRow[]>>(`/adres/mahalle/${provinceId}.json`)
      .then((byDistrict) => { if (alive) setPlaces({ province: provinceId, byDistrict }); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [provinceId]);

  const rows = district && places?.province === provinceId ? places?.byDistrict[district.id] : undefined;

  const error = (k: ContactField) => (errors[k] ? <div className="cart-err" id={`c-${k}-hata`}>{errors[k]}</div> : null);
  const attrs = (k: ContactField) => ({ 'aria-invalid': Boolean(errors[k]), 'aria-describedby': errors[k] ? `c-${k}-hata` : undefined });
  const field = (k: keyof ContactForm & ContactField, label: React.ReactNode, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="adr-field">
      <label className="cart-label" htmlFor={`c-${k}`}>{label}</label>
      <input id={`c-${k}`} className="cart-input" {...attrs(k)} value={form[k] as string} onChange={(e) => onChange({ [k]: e.target.value })} {...props} />
      {error(k)}
    </div>
  );

  /* Liste inemezse müşteri adresini elle yazabilsin. */
  const typed = failed && !provinces;

  return (
    <>
      <fieldset className="adr-group">
        <legend>Teslimat adresi</legend>
        {failed && (
          <p className="adr-warn" role="alert">
            Adres listesi yüklenemedi; alanları elle yazabilirsiniz.{' '}
            <button type="button" onClick={loadProvinces}>Tekrar deneyin</button>
          </p>
        )}

        {typed ? (
          <div className="cart-two">
            {field('city', 'İl', { autoComplete: 'address-level1', maxLength: 60 })}
            {field('district', 'İlçe', { autoComplete: 'address-level2', maxLength: 60 })}
          </div>
        ) : (
          <div className="cart-two">
            <div>
              <PickerField
                id="c-city" label="İl" value={form.city} placeholder="İl seçin" loading={!provinces}
                disabled={!provinces} invalid={Boolean(errors.city)} describedBy={attrs('city')['aria-describedby']}
                options={(provinces ?? []).map((p) => ({ value: String(p.id), label: p.ad }))}
                onPick={(o) => { setManual(false); if (o.label !== form.city) onChange({ city: o.label, district: '', neighborhood: '', postalCode: '' }); }}
              />
              {error('city')}
            </div>
            <div>
              <PickerField
                id="c-district" label="İlçe" value={form.district} placeholder={province ? 'İlçe seçin' : 'Önce il seçin'}
                disabled={!province} invalid={Boolean(errors.district)} describedBy={attrs('district')['aria-describedby']}
                options={(province?.ilceler ?? []).map((d) => ({ value: String(d.id), label: d.ad }))}
                onPick={(o) => { setManual(false); if (o.label !== form.district) onChange({ district: o.label, neighborhood: '', postalCode: '' }); }}
              />
              {error('district')}
            </div>
          </div>
        )}

        {typed || manual ? (
          <>
            {field('neighborhood', 'Mahalle ya da köy', { autoComplete: 'address-level3', maxLength: 100 })}
            {manual && <button type="button" className="adr-link" onClick={() => { setManual(false); onChange({ neighborhood: '', postalCode: '' }); }}>Listeden seçeyim</button>}
          </>
        ) : (
          <div>
            <PickerField
              id="c-neighborhood" label="Mahalle ya da köy" value={form.neighborhood}
              placeholder={district ? 'Mahalle ya da köy seçin' : 'Önce ilçe seçin'}
              disabled={!district || !rows} loading={Boolean(district) && !rows}
              invalid={Boolean(errors.neighborhood)} describedBy={attrs('neighborhood')['aria-describedby']}
              options={(rows ?? []).map((r, i) => ({ value: String(i), label: placeName(r), hint: r[1] }))}
              onPick={(o) => onChange({ neighborhood: o.label, postalCode: o.hint ?? '' })}
              onCustom={() => { setManual(true); onChange({ neighborhood: '', postalCode: '' }); }}
            />
            {error('neighborhood')}
          </div>
        )}

        {field('street', 'Cadde / sokak', { autoComplete: 'address-line1', maxLength: 120, placeholder: 'Atatürk Caddesi, 1204. Sokak' })}
        <div className="adr-three">
          {field('buildingNo', 'Bina no', { maxLength: 20, autoComplete: 'off' })}
          {field('doorNo', <>Daire <span>(varsa)</span></>, { maxLength: 20, autoComplete: 'off' })}
          {field('postalCode', 'Posta kodu', {
            inputMode: 'numeric', maxLength: 5, autoComplete: 'postal-code',
            onChange: (e) => onChange({ postalCode: e.target.value.replace(/\D/g, '').slice(0, 5) }),
          })}
        </div>
        {field('directions', <>Adres tarifi <span>(isteğe bağlı)</span></>, { maxLength: 200, autoComplete: 'off', placeholder: 'Kat, site adı, yakın bir yer' })}

        {form.neighborhood && form.street && (
          <div className="adr-preview" aria-live="polite">
            <b>Kargo bu adrese gidecek</b>
            <p>{formatAddress(form)}</p>
          </div>
        )}
      </fieldset>

      <label className="cart-consent">
        <input type="checkbox" checked={form.otherRecipient} onChange={(e) => onChange({ otherRecipient: e.target.checked })} />
        <span>Paketi başka biri teslim alacak (hediye gönderimi)</span>
      </label>
      {form.otherRecipient && (
        <div className="cart-two">
          {field('recipientName', 'Alıcının adı soyadı', { maxLength: 80, autoComplete: 'off' })}
          {field('recipientPhone', 'Alıcının telefonu', { type: 'tel', maxLength: 18, autoComplete: 'off', placeholder: '05xx xxx xx xx' })}
        </div>
      )}

      <label className="cart-consent">
        <input type="checkbox" checked={form.corporate} onChange={(e) => onChange({ corporate: e.target.checked })} />
        <span>Kurumsal fatura istiyorum</span>
      </label>
      {form.corporate && (
        <>
          {field('company', 'Firma ünvanı', { maxLength: 120, autoComplete: 'organization' })}
          <div className="cart-two">
            {field('taxOffice', 'Vergi dairesi', { maxLength: 60, autoComplete: 'off' })}
            {field('taxNo', 'Vergi numarası', {
              inputMode: 'numeric', maxLength: 11, autoComplete: 'off',
              onChange: (e) => onChange({ taxNo: e.target.value.replace(/\D/g, '').slice(0, 11) }),
            })}
          </div>
        </>
      )}
    </>
  );
}
