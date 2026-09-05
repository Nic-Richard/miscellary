import base from '@miscellary/config/eslint';
import next from '@next/eslint-plugin-next';

export default [
  ...base,
  {
    plugins: { '@next/next': next },
    rules: {
      ...next.configs.recommended.rules,
      ...next.configs['core-web-vitals'].rules,
      // Card art is user-uploaded and served straight from S3; plain <img> is intentional.
      '@next/next/no-img-element': 'off',
    },
  },
  { ignores: ['next-env.d.ts', '.next/**'] },
];
