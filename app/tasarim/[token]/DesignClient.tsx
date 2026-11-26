'use client';

import Link from 'next/link';
import { useState } from 'react';
import { WhatsAppIcon, CloseIcon, CheckIcon } from '@/components/icons';
import { cloudinaryUrl } from '@/lib/format';
import { WHATSAPP_BASE } from '@/lib/constants';
import {
  Design, MAX_DESIGN_FILES, MAX_DESIGN_NOTE, canCustomerEdit, designMessage, designNo,
} from '@/lib/design-types';
import {
  addDesignFileRequest, removeDesignFileRequest, submitDesignRequest, updateDesignRequest,
} from '@/lib/design-client';

interface ProductOption { slug: string; title: string; colors: string[] }

interface Props {
  design: Omit<Design, 'adminNote'>;
  products: ProductOption[];
}

export default function DesignClient({ design, products }: Props) {
  const editable = canCustomerEdit(design.status);
  const [files, setFiles] = useState(design.files);
  const [note, setNote] = useState(design.note ?? '');
  const [slug, setSlug] = useState(design.productSlug);
  const [color, setColor] = useState(design.color ?? '');
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState('');
  const [savedNote, setSavedNote] = useState(design.note ?? '');
  const [sent, setSent] = useState(design.status !== 'taslak');

  const product = products.find((p) => p.slug === slug);
  // Vitrinden seçilen kulp rengi katalogdaki renk listesinde olmayabilir; yine de gösterilir.
  const colorOptions = Array.from(new Set([...(product?.colors ?? []), ...(color ? [color] : [])]));
  const waHref = `${WHATSAPP_BASE}?text=${encodeURIComponent(designMessage(design.token))}`;

  const attempt = async (job: () => Promise<unknown>) => {
    setError('');
    try { await job(); return true; } catch (e) {
      setError(e instanceof Error ? e.message : 'İşlem tamamlanamadı.');
      return false;
    }
  };

  const addFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []).slice(0, MAX_DESIGN_FILES - files.length);
    e.target.value = '';
    setUploading(picked.length);
    for (const file of picked) {
      await attempt(async () => {
        const id = await addDesignFileRequest(design.token, file);
        setFiles((prev) => [...prev, id]);
      });
      setUploading((n) => n - 1);
    }
  };

  const removeFile = (id: string) =>
    attempt(async () => {
      await removeDesignFileRequest(design.token, id);
      setFiles((prev) => prev.filter((f) => f !== id));
    });

  const changeProduct = (next: string) => {
    setSlug(next);
    setColor('');
    attempt(() => updateDesignRequest(design.token, { productSlug: next }));
  };

  const changeColor = (next: string) => {
    setColor(next);
    attempt(() => updateDesignRequest(design.token, { color: next }));
  };

  const saveNote = async () => {
    if (note === savedNote) return;
    if (await attempt(() => updateDesignRequest(design.token, { note }))) setSavedNote(note);
  };

  const send = () => {
    // Bağlantı WhatsApp'ı hemen açar; kayıt arka planda tamamlanır.
    saveNote();
    attempt(async () => {
      await submitDesignRequest(design.token);
      setSent(true);
    });
  };

  return (
    <div className="wrap dsg">
      <div className="dsg-head">
        <h1 className="h2">{sent ? 'Siparişiniz bizde' : 'Son bir adım'}</h1>
        <p>
          {sent
            ? 'Bu bağlantıyı saklayın; işleme alınana kadar fotoğraf ve not ekleyebilirsiniz.'
            : 'Fotoğraflarınızı ve notunuzu ekleyin, sonra WhatsApp’tan gönderin. Mesaja yalnızca bu sayfanın bağlantısı eklenir.'}
        </p>
        <p className="dsg-no">Sipariş no: <b>{designNo(design.token)}</b></p>
      </div>

      <div className="dsg-grid">
        {design.preview && (
          <figure className="dsg-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cloudinaryUrl(design.preview, 'f_auto,q_auto,w_900,c_limit')} alt="Hazırladığınız kupa önizlemesi" />
            <figcaption>
              Önizleme fikir verir; baskıdan önce son halini onayınıza göndeririz.
              {design.removeBg && ' Arka planın silinmesini istediniz.'}
            </figcaption>
          </figure>
        )}

        <div className="dsg-form">
          <div className="dsg-field">
            <label htmlFor="dsg-kupa">Kupa</label>
            <select id="dsg-kupa" value={slug} disabled={!editable} onChange={(e) => changeProduct(e.target.value)}>
              {!product && <option value={slug}>{design.productTitle}</option>}
              {products.map((p) => <option key={p.slug} value={p.slug}>{p.title}</option>)}
            </select>
          </div>

          {colorOptions.length > 0 && (
            <div className="dsg-field">
              <label htmlFor="dsg-renk">Renk</label>
              <select id="dsg-renk" value={color} disabled={!editable} onChange={(e) => changeColor(e.target.value)}>
                <option value="" disabled>Renk seçin</option>
                {colorOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          {design.text && (
            <p className="dsg-text">
              Kupadaki yazı: <b>{design.text}</b> ({design.font === 'el' ? 'el yazısı' : 'düz yazı'})
            </p>
          )}

          <div className="dsg-field">
            <span className="dsg-label">Fotoğraflar ({files.length}/{MAX_DESIGN_FILES})</span>
            <ul className="dsg-files">
              {files.map((id, i) => (
                <li key={id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cloudinaryUrl(id, 'f_auto,q_auto,w_240,h_240,c_fill')} alt={`Yüklediğiniz fotoğraf ${i + 1}`} />
                  {editable && (
                    <button type="button" onClick={() => removeFile(id)} aria-label={`${i + 1}. fotoğrafı kaldır`}>
                      <CloseIcon size={16} />
                    </button>
                  )}
                </li>
              ))}
              {editable && files.length < MAX_DESIGN_FILES && (
                <li>
                  <label className="dsg-add">
                    {uploading > 0 ? 'Yükleniyor…' : 'Fotoğraf ekle'}
                    <input type="file" accept="image/*" multiple className="sr-only" disabled={uploading > 0} onChange={addFiles} />
                  </label>
                </li>
              )}
            </ul>
          </div>

          <div className="dsg-field">
            <label htmlFor="dsg-not">Notunuz</label>
            <textarea
              id="dsg-not"
              rows={4}
              maxLength={MAX_DESIGN_NOTE}
              value={note}
              disabled={!editable}
              placeholder="Adet, ölçü, nasıl bir tasarım istediğiniz…"
              onChange={(e) => setNote(e.target.value)}
              onBlur={saveNote}
            />
            {savedNote && note === savedNote && <span className="dsg-saved"><CheckIcon size={16} /> Not kaydedildi</span>}
          </div>

          <p className="dsg-error" role="alert">{error}</p>

          {uploading > 0 ? (
            <button type="button" className="btn btn-primary btn-block" disabled>Fotoğraflar yükleniyor…</button>
          ) : (
            <a className="btn btn-primary btn-block" href={waHref} target="_blank" rel="noopener noreferrer" onClick={editable ? send : undefined}>
              <WhatsAppIcon /> {sent ? 'WhatsApp’tan yazın' : 'WhatsApp’tan gönderin'}
            </a>
          )}
          <p className="dsg-privacy">
            Yüklediğiniz fotoğraflar yalnızca siparişiniz için saklanır. Gönderilmeyen taslaklar 7 gün sonra silinir.
          </p>
          <Link href="/" className="text-link">Ana sayfaya dönün</Link>
        </div>
      </div>
    </div>
  );
}
