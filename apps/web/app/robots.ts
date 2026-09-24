import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

const PRIVATE = [
  '/account',
  '/collection',
  '/editor-proof',
  '/forgot-password',
  '/login',
  '/notifications',
  '/packs',
  '/register',
  '/reset-password',
  '/studio',
  '/trades',
  '/verify-email',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: PRIVATE },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
