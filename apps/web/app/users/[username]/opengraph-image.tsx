import { OG_SIZE, Pack, pngFrom, shareImage } from '@/lib/og';
import { getProfile } from '@/lib/social';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'A Miscellary collector';

const FAN = [
  { rotate: -10, x: -96, y: 14 },
  { rotate: 10, x: 96, y: 14 },
  { rotate: 0, x: 0, y: 0 },
];

export default async function Image({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getProfile(username).catch(() => null);
  const packs = (
    await Promise.all(
      (profile?.sets ?? []).slice(0, 3).map((set) => pngFrom(set.render_pack?.image?.url, 520)),
    )
  ).filter((src): src is string => src !== null);
  const fan = FAN.slice(3 - packs.length);
  const name = profile ? profile.display_name || profile.username : 'Miscellary';

  return shareImage({
    object:
      packs.length === 1 ? (
        <Pack src={packs[0]!} width={340} />
      ) : (
        <div style={{ display: 'flex', position: 'relative', width: 440, height: 420 }}>
          {packs.map((src, index) => (
            <div
              key={src}
              style={{
                display: 'flex',
                position: 'absolute',
                left: 110 + fan[index]!.x,
                top: 30 + fan[index]!.y,
                transform: `rotate(${fan[index]!.rotate}deg)`,
              }}
            >
              <Pack src={src} width={220} />
            </div>
          ))}
        </div>
      ),
    title: name,
    lines: profile
      ? [
          `@${profile.username}`,
          `${profile.set_count} ${profile.set_count === 1 ? 'set' : 'sets'} published, ${profile.card_count} cards collected`,
        ]
      : [],
  });
}
