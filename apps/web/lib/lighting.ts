// Resolves one fixed binder key light into per-slot material variables.

import type { CSSProperties } from 'react';

export const KEY_LIGHT = { x: 26, y: 8 };
const BASE_ANGLE = 104;
// Compensate for the binder spread's wide aspect ratio.
const VERTICAL_REACH = 0.62;
const FALLOFF = 90;

export function slotLight(centreX: number, centreY: number): CSSProperties {
  const dx = centreX - KEY_LIGHT.x;
  const dy = centreY - KEY_LIGHT.y;
  const reach = Math.hypot(dx, dy * VERTICAL_REACH) / FALLOFF;
  return {
    '--lit-angle': `${(BASE_ANGLE + dx * 0.44 + dy * 0.17).toFixed(1)}deg`,
    '--lit-strength': Math.max(0.86, 1.38 - reach * 0.6).toFixed(3),
    '--lit-shift-x': (22 - dx * 0.35).toFixed(1),
    '--lit-shift-y': (-14 + dy * 0.25).toFixed(1),
    '--cast-x': (dx * 0.006).toFixed(3),
    '--cast-y': (0.18 + dy * 0.005).toFixed(3),
  } as CSSProperties;
}
