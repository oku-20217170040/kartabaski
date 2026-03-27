interface Props {
  height?: number;
}

export default function LogoSVG({ height = 36 }: Props) {
  // viewBox: 460x100, background rect kaldırıldı (transparan)
  const width = (460 / 100) * height;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 460 100"
      width={width}
      height={height}
      aria-label="ÜmitSpot"
      role="img"
      style={{ display: 'block', flexShrink: 0 }}
    >
      {/* Geometric icon — overlapping diamonds */}
      <polygon points="50,10 82,50 50,90 18,50" fill="#1DB954" />
      <polygon points="62,22 86,50 62,78 38,50" fill="#0B0F14" />
      <polygon points="62,36 72,50 62,64 52,50" fill="#1DB954" />

      {/* Wordmark — birleşik */}
      <text
        x="106" y="66"
        fontFamily="'Arial Black','Helvetica Neue',Helvetica,sans-serif"
        fontWeight="900" fontSize="50" letterSpacing="-2.5"
      >
        <tspan fill="#FFFFFF">Ümit</tspan><tspan fill="#1DB954">Spot</tspan>
      </text>
    </svg>
  );
}
