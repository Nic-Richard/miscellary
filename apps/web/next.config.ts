import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@miscellary/shared'],
  ...(process.env.NEXT_OUTPUT_STANDALONE === 'true'
    ? {
        output: 'standalone',
        outputFileTracingRoot: path.join(process.cwd(), '../..'),
      }
    : {}),
};

export default nextConfig;
