import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Stroke({ size = 20, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export function WhatsAppIcon({ size = 18, ...rest }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...rest}>
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.47-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.42.25-.7.25-1.29.18-1.41-.08-.13-.28-.2-.57-.35m-5.42 7.4h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.88 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.69 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.41Z" />
    </svg>
  );
}

export function InstagramIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" />
    </Stroke>
  );
}

export function MenuIcon(props: IconProps) {
  return <Stroke {...props}><path d="M4 7h16M4 12h16M4 17h16" /></Stroke>;
}

export function CloseIcon(props: IconProps) {
  return <Stroke {...props}><path d="M6 6l12 12M18 6L6 18" /></Stroke>;
}

export function ArrowRightIcon(props: IconProps) {
  return <Stroke {...props}><path d="M5 12h14M13 6l6 6-6 6" /></Stroke>;
}

export function ChevronLeftIcon(props: IconProps) {
  return <Stroke {...props}><path d="M15 6l-6 6 6 6" /></Stroke>;
}

export function ChevronRightIcon(props: IconProps) {
  return <Stroke {...props}><path d="M9 6l6 6-6 6" /></Stroke>;
}

export function ChevronDownIcon(props: IconProps) {
  return <Stroke {...props}><path d="M6 9l6 6 6-6" /></Stroke>;
}

export function SearchIcon(props: IconProps) {
  return <Stroke {...props}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></Stroke>;
}

export function PhoneIcon(props: IconProps) {
  return <Stroke {...props}><path d="M5 4h3.5l1.5 4-2 1.5a11 11 0 0 0 6.5 6.5l1.5-2 4 1.5V19a1.5 1.5 0 0 1-1.6 1.5A16 16 0 0 1 3.5 5.6 1.5 1.5 0 0 1 5 4Z" /></Stroke>;
}

export function MailIcon(props: IconProps) {
  return <Stroke {...props}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3.5 6.5l8.5 6.5 8.5-6.5" /></Stroke>;
}

export function TruckIcon(props: IconProps) {
  return <Stroke {...props}><path d="M3 6h11v10H3zM14 9h4l3 3v4h-7" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></Stroke>;
}

export function ShareIcon(props: IconProps) {
  return <Stroke {...props}><path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" /></Stroke>;
}

export function LinkIcon(props: IconProps) {
  return <Stroke {...props}><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></Stroke>;
}

export function ZoomIcon(props: IconProps) {
  return <Stroke {...props}><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2M11 8v6M8 11h6" /></Stroke>;
}

export function CheckIcon(props: IconProps) {
  return <Stroke {...props}><path d="M5 12.5l4.5 4.5L19 7.5" /></Stroke>;
}

export function SlidersIcon(props: IconProps) {
  return <Stroke {...props}><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></Stroke>;
}
