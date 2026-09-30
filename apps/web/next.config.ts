import type { NextConfig } from 'next';
import path from 'node:path';

const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@miscellary/shared'],
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  ...(process.env.NEXT_OUTPUT_STANDALONE === 'true'
    ? {
        output: 'standalone',
        outputFileTracingRoot: path.join(process.cwd(), '../..'),
      }
    : {}),
};

export default nextConfig;
