export default function SwapArrow({ className }: { className?: string | undefined }) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <path d="M4 9h14l-4-4M20 15H6l4 4" />
      </svg>
    </span>
  );
}
