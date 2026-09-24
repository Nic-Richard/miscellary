import { ImageResponse } from 'next/og';
import type { ReactNode } from 'react';
import sharp from 'sharp';

export const OG_SIZE = { width: 1200, height: 630 };

const INK = '#372e25';
const MUTED = '#6f6355';
const TEAL = '#1e6e67';

type Font = { name: string; data: ArrayBuffer; weight: 400 | 700; style: 'normal' };

// Without a browser user agent Google Fonts serves TrueType, which is what Satori reads.
async function googleFont(family: string, weight: 400 | 700): Promise<Font | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`)
    ).text();
    const src = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1];
    if (!src) return null;
    const data = await (await fetch(src)).arrayBuffer();
    return { name: family.replace(/\+/g, ' '), data, weight, style: 'normal' };
  } catch {
    return null;
  }
}

let fonts: Promise<Font[]> | null = null;
function loadFonts(): Promise<Font[]> {
  fonts ??= Promise.all([
    googleFont('Bebas+Neue', 400),
    googleFont('Roboto+Condensed', 400),
    googleFont('Roboto+Condensed', 700),
  ]).then((found) => found.filter((font): font is Font => font !== null));
  return fonts;
}

/** Satori cannot decode WebP, which is what the baked renders are stored as. */
export async function pngFrom(url: string | null | undefined, width: number) {
  if (!url) return null;
  try {
    const source = Buffer.from(await (await fetch(url)).arrayBuffer());
    const png = await sharp(source).resize({ width, withoutEnlargement: true }).png().toBuffer();
    return `data:image/png;base64,${png.toString('base64')}`;
  } catch {
    return null;
  }
}

function Mark() {
  return (
    <svg width="44" height="33" viewBox="0 0 64 48">
      <g fill="none" stroke={TEAL} strokeWidth="2.4" strokeLinejoin="round">
        <rect x="10" y="10" width="20" height="30" rx="2.5" transform="rotate(-16 20 25)" />
        <rect x="34" y="10" width="20" height="30" rx="2.5" transform="rotate(16 44 25)" />
        <rect x="22" y="6" width="20" height="32" rx="2.5" fill="#f4eee1" />
      </g>
      <path
        d="m32 15 1.9 4 4.3.5-3.2 2.9.9 4.3-3.9-2.2-3.9 2.2.9-4.3-3.2-2.9 4.3-.5Z"
        fill={TEAL}
      />
    </svg>
  );
}

export async function shareImage({
  object,
  title,
  lines,
}: {
  object: ReactNode;
  title: string;
  lines: string[];
}) {
  const size = title.length > 34 ? 76 : title.length > 20 ? 96 : 118;
  return new ImageResponse(
    <div
      style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        padding: '56px 72px 52px 56px',
        background: 'linear-gradient(135deg, #f7f1e5 0%, #efe6d4 100%)',
        fontFamily: 'Roboto Condensed',
        color: INK,
      }}
    >
      <div
        style={{
          display: 'flex',
          width: 440,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {object}
      </div>
      <div
        style={{
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          paddingLeft: 48,
        }}
      >
        <div
          style={{
            display: 'flex',
            flex: 1,
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontFamily: 'Bebas Neue',
              fontSize: size,
              lineHeight: 0.92,
              letterSpacing: '0.01em',
            }}
          >
            {title}
          </div>
          {lines.map((line) => (
            <div key={line} style={{ display: 'flex', marginTop: 18, fontSize: 30, color: MUTED }}>
              {line}
            </div>
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            fontSize: 26,
            fontWeight: 700,
            color: TEAL,
          }}
        >
          <Mark />
          <span style={{ marginLeft: 12 }}>miscellary.com</span>
        </div>
      </div>
    </div>,
    { ...OG_SIZE, fonts: await loadFonts() },
  );
}

export function Pack({ src, width }: { src: string; width: number }) {
  return (
    <img
      src={src}
      width={width}
      height={(width * 5) / 4}
      style={{ borderRadius: 8, boxShadow: '0 18px 40px rgba(40, 28, 12, 0.3)' }}
    />
  );
}
