import base from '@miscellary/config/eslint';

const node = ['Buffer', 'URL', 'WebSocket', 'console', 'fetch', 'process', 'setTimeout'];

export default [
  ...base,
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { globals: Object.fromEntries(node.map((name) => [name, 'readonly'])) },
  },
  { ignores: ['babel.config.cjs', 'metro.config.cjs', '.expo/**', 'generated/**'] },
];
