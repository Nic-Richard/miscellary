import type { TemplateConfig } from './api';

// Mirrors PHOTO_FRAME in apps/api/cards/templates.py.
export const PHOTO_ZOOM_MAX = 4;

export interface PhotoFrame {
  x: number;
  y: number;
  zoom: number;
}

const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

function read(value: string | undefined, fallback: number, low: number, high: number): number {
  const number = value === undefined ? NaN : Number(value);
  return Number.isFinite(number) ? clamp(number, low, high) : fallback;
}

export function photoFrame(config: TemplateConfig | undefined): PhotoFrame {
  return {
    x: read(config?.photo_x, 50, 0, 100),
    y: read(config?.photo_y, 50, 0, 100),
    zoom: read(config?.photo_zoom, 1, 1, PHOTO_ZOOM_MAX),
  };
}

export function withPhotoFrame(config: TemplateConfig, frame: PhotoFrame): TemplateConfig {
  const round = (value: number) => String(Math.round(value * 100) / 100);
  return {
    ...config,
    photo_x: round(clamp(frame.x, 0, 100)),
    photo_y: round(clamp(frame.y, 0, 100)),
    photo_zoom: round(clamp(frame.zoom, 1, PHOTO_ZOOM_MAX)),
  };
}

export function photoFrameKeys(config: TemplateConfig): TemplateConfig {
  const out: TemplateConfig = {};
  for (const key of ['photo_x', 'photo_y', 'photo_zoom'] as const) {
    if (config[key] !== undefined) out[key] = config[key];
  }
  return out;
}

// Mirrors LICENCES in apps/api/uploads/serializers.py.
export const PHOTO_LICENCES = [
  { value: 'own', label: 'My own photo' },
  { value: 'cc-by', label: 'CC BY 4.0' },
  { value: 'cc-by-sa', label: 'CC BY-SA 4.0' },
  { value: 'public-domain', label: 'Public domain' },
  { value: 'permission', label: 'Used with permission' },
  { value: 'other', label: 'Other' },
] as const;

export type PhotoLicence = (typeof PHOTO_LICENCES)[number]['value'];

export function licenceOf(credit: { author: string; license: string } | null | undefined) {
  if (!credit?.author) return 'own' as PhotoLicence;
  const match = PHOTO_LICENCES.find((l) => l.value !== 'own' && l.label === credit.license);
  if (match) return match.value;
  return 'other' as PhotoLicence;
}
