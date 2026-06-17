import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@config': path.resolve(__dirname, 'src/config'),
      '@modules': path.resolve(__dirname, 'src/modules'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@middlewares': path.resolve(__dirname, 'src/middlewares'),
      '@queues': path.resolve(__dirname, 'src/queues'),
      '@plugins': path.resolve(__dirname, 'src/plugins'),
      '@observability': path.resolve(__dirname, 'src/observability'),
      '@types-app': path.resolve(__dirname, 'src/types'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
