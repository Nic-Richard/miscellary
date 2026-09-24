import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#278b82',
      }}
    >
      <svg width="132" height="99" viewBox="0 0 64 48">
        <g fill="none" stroke="#f6f0e4" strokeWidth="2.2" strokeLinejoin="round">
          <rect x="10" y="10" width="20" height="30" rx="2.5" transform="rotate(-16 20 25)" />
          <rect x="34" y="10" width="20" height="30" rx="2.5" transform="rotate(16 44 25)" />
          <rect x="22" y="6" width="20" height="32" rx="2.5" fill="#278b82" />
        </g>
        <path
          d="m32 15 1.9 4 4.3.5-3.2 2.9.9 4.3-3.9-2.2-3.9 2.2.9-4.3-3.2-2.9 4.3-.5Z"
          fill="#f6f0e4"
        />
      </svg>
    </div>,
    size,
  );
}
