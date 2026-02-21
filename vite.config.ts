import { defineConfig } from 'vite';

// Use VITE_BASE_PATH env var when set (e.g. '/kinetype-ai/' for GitHub Pages),
// otherwise default to '/' (works for Vercel and local dev).
const base = process.env['VITE_BASE_PATH'] ?? '/';

export default defineConfig({
  base,
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
});
