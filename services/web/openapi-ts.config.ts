import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'http://localhost:3000/json',
  output: {
    path: 'src/shared/api/generated',
    format: 'prettier',
    // lint: 'eslint' — Phase 9 (zod v4 마이그레이션) 전까지 비활성화.
    // hey-api 내부 의존성이 zod/v4/core를 요구하나 ts-rest 호환을 위해 zod 3.22.x로 lock된 상태.
  },
  plugins: [
    {
      name: '@hey-api/client-axios',
      runtimeConfigPath: './src/shared/api/runtime-config.ts',
    },
    '@hey-api/typescript',
    '@hey-api/sdk',
    '@tanstack/react-query',
  ],
});
