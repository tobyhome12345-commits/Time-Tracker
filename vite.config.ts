/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

export default defineConfig({
  plugins: [react()],
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(process.env.APP_VERSION ?? pkg.version),
  },
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: false,
  },
  server: { host: true, port: 5173 },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
