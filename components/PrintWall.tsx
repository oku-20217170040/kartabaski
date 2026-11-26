import Link from 'next/link';
import { PRINT_SAMPLES, sampleHref } from '@/lib/vitrin';

/** Basılı kupa örnekleri; her parça o fotoğrafın ürün sayfasını açar. */
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
          <Link key={s.file} className={`parca t-${s.tone}${s.size ? ` is-${s.size}` : ''}`} href={sampleHref(s)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/vitrin/${s.file}.webp`} alt={`${s.label} baskılı kupa`} loading="lazy" />
            <span>
              {s.label}
              <em>Ürüne bakın</em>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
