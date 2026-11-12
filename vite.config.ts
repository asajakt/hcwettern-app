import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' så att appen fungerar oavsett var den publiceras (GitHub Pages, Cloudflare Pages, egen domän)
export default defineConfig({
  base: './',
  plugins: [react()],
  test: { include: ['scraper/**/*.test.ts'] },
} as never);
