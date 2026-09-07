import type { Gradient } from '@miscellary/shared';

export const CARD_RATIO = 7 / 5;

export function share(width: number, value: number): number {
  return (value / 100) * width;
}

export interface GradientGeometry {
  colors: readonly [string, string, ...string[]];
  locations: readonly [number, number, ...number[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
}

// CSS angles start upward and run clockwise; Expo expects unit endpoints.
export function gradientGeometry(
  gradient: Gradient,
  width: number,
  height: number,
): GradientGeometry {
  const radians = (gradient.angle * Math.PI) / 180;
  const dirX = Math.sin(radians);
  const dirY = -Math.cos(radians);
  const length = Math.abs(width * dirX) + Math.abs(height * dirY);
  const halfX = (length * dirX) / 2 / (width || 1);
  const halfY = (length * dirY) / 2 / (height || 1);

  // Expo requires at least two gradient stops.
  const stops = gradient.stops.length > 1 ? gradient.stops : [...gradient.stops, ...gradient.stops];
  const raw = stops.map((stop, index) => {
    if (stop.at !== undefined) return stop.at / 100;
    if (index === 0) return 0;
    if (index === stops.length - 1) return 1;
    return index / (stops.length - 1);
  });
  // Expo requires monotonically increasing locations.
  let highest = 0;
  const locations = raw.map((value) => (highest = Math.max(highest, value)));

  return {
    colors: stops.map((stop) => stop.color) as unknown as readonly [string, string, ...string[]],
    locations: locations as unknown as readonly [number, number, ...number[]],
    start: { x: 0.5 - halfX, y: 0.5 - halfY },
    end: { x: 0.5 + halfX, y: 0.5 + halfY },
  };
}

export function fade(colour: string, percent: number): string {
  const parsed = parseColour(colour);
  if (!parsed) return colour;
  const [r, g, b, a] = parsed;
  return `rgba(${r}, ${g}, ${b}, ${(a * percent) / 100})`;
}

export function mix(colour: string, percent: number, other: string): string {
  const a = parseColour(colour);
  const b = parseColour(other);
  if (!a || !b) return colour;
  const weight = percent / 100;
  const channel = (index: number) => Math.round(a[index]! * weight + b[index]! * (1 - weight));
  const alpha = a[3] * weight + b[3] * (1 - weight);
  return `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, ${alpha})`;
}

function parseColour(colour: string): [number, number, number, number] | null {
  const hex = colour.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const value = hex[1]!;
    const full =
      value.length === 3
        ? value
            .split('')
            .map((c) => c + c)
            .join('')
        : value;
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16),
      1,
    ];
  }
  const rgb = colour.trim().match(/^rgba?\(([^)]+)\)$/i);
  if (rgb) {
    const parts = rgb[1]!.split(',').map((p) => Number(p.trim()));
    if (parts.length < 3 || parts.some(Number.isNaN)) return null;
    return [parts[0]!, parts[1]!, parts[2]!, parts[3] ?? 1];
  }
  return null;
}
