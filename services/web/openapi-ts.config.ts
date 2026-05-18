import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
  input: 'http://localhost:3000/json',
  output: {
    path: 'src/shared/api/generated',
    format: 'prettier',
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
