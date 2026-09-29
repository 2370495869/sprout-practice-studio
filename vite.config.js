import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => {
  const { VITE_BASE_PATH: basePath } = loadEnv(mode, projectRoot, 'VITE_');

  return {
    base: basePath || '/',
    build: {
      rollupOptions: {
        input: {
          home: resolve(projectRoot, 'index.html'),
          study: resolve(projectRoot, 'learn.html'),
        },
      },
    },
    server: { host: '127.0.0.1' },
    preview: { host: '127.0.0.1' },
  };
});
