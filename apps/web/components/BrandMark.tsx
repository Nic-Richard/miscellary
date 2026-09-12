export default function BrandMark({ className }: { className?: string | undefined }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <rect x="10" y="10" width="20" height="30" rx="2.5" transform="rotate(-16 20 25)" />
        <rect x="34" y="10" width="20" height="30" rx="2.5" transform="rotate(16 44 25)" />
        <rect x="22" y="6" width="20" height="32" rx="2.5" fill="var(--sur)" />
      </g>
      <path
        d="m32 15 1.9 4 4.3.5-3.2 2.9.9 4.3-3.9-2.2-3.9 2.2.9-4.3-3.2-2.9 4.3-.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
