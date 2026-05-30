import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'src/shared/api/generated']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/shared/ui/catalyst', '@/shared/ui/catalyst/*'],
              message:
                'catalyst 는 v1.X 제거 예정 — 신규 import 금지. @/shared/ui (barrel) 경유로 import. 정책: services/web/src/shared/ui/catalyst/README.md',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/shared/ui/catalyst/**', 'src/shared/ui/index.ts'],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]);
