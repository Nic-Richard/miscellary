import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Miscellary',
    short_name: 'Miscellary',
    description: 'Turn collections into trading cards.',
    start_url: '/',
    display: 'standalone',
    background_color: '#c3c3bb',
    theme_color: '#414e63',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  };
}
