import { useId } from 'react';

const MIDDLE = { x: 22, y: 6, width: 20, height: 32, rx: 2.5 };

export default function BrandMark({ className }: { className?: string | undefined }) {
  const mask = useId();
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden="true">
      {/* The middle card is cut out of the two behind it, so it stays hollow on any background. */}
      <mask id={mask}>
        <rect width="64" height="48" fill="#fff" />
        <rect {...MIDDLE} fill="#000" stroke="#000" strokeWidth="4" />
      </mask>
      <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <g mask={`url(#${mask})`}>
          <rect x="10" y="10" width="20" height="30" rx="2.5" transform="rotate(-16 20 25)" />
          <rect x="34" y="10" width="20" height="30" rx="2.5" transform="rotate(16 44 25)" />
        </g>
        <rect {...MIDDLE} />
      </g>
      <path
        d="m32 15 1.9 4 4.3.5-3.2 2.9.9 4.3-3.9-2.2-3.9 2.2.9-4.3-3.2-2.9 4.3-.5Z"
        fill="currentColor"
      />
    </svg>
  );
}
