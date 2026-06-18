import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'spikes/', '.specify/', 'coverage/'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // 憲章 III: any 禁止
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
