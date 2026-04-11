interface Props {
  height?: number;
}

export default function LogoSVG({ height = 44 }: Props) {
  const width = height; // square logo
  return (
    <img
      src="/logo.png"
      alt="KAR-TA BASKI"
      width={width}
      height={height}
      style={{ display: 'block', flexShrink: 0, objectFit: 'contain' }}
    />
  );
}
