import { WHATSAPP_BASE } from '@/lib/constants';
import { PRINT_SAMPLES } from '@/lib/vitrin';

/** Basılı kupa örnekleri; her parça aynı türde baskı için WhatsApp mesajı açar. */
export default function PrintWall() {
  return (
    <section className="ornekler" aria-labelledby="ornekler-baslik">
      <div className="wrap blok-head">
        <h2 id="ornekler-baslik" className="h2">
          Fotoğraf, logo, çizim.<br />Gönderin, basalım.
        </h2>
        <p>Hazır şablona gerek yok. Telefonunuzdaki bir kare de olur, defter kenarına çizdiğiniz bir şey de.</p>
      </div>
      <div className="mozaik">
        {PRINT_SAMPLES.map((s) => (
          <a
            key={s.file}
            className={`parca t-${s.tone}${s.size ? ` is-${s.size}` : ''}`}
            href={`${WHATSAPP_BASE}?text=${encodeURIComponent(`Merhaba, sitedeki "${s.label}" örneğine benzer bir baskı istiyorum.`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/vitrin/${s.file}.webp`} alt={`${s.label} baskılı kupa`} loading="lazy" />
            <span>
              {s.label}
              <em>Benzerini isteyin</em>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
