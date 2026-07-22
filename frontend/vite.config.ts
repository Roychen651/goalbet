import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // V7 Sprint 52 — src/workers/monteCarloWorker.ts is loaded via
  // `new Worker(new URL(..., import.meta.url), { type: 'module' })`.
  // Vite's default worker output format is 'iife'; 'es' is required for
  // a module worker (the `export`s in monteCarloWorker.ts, and any future
  // worker that wants to import a shared helper) to actually work.
  worker: {
    format: 'es',
  },
  build: {
    // The framer-motion vendor chunk is legitimately large and well understood —
    // don't let it spam CI. This still surfaces any genuinely oversized chunk.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Split heavy, stable third-party libs into their own long-cached chunks.
        // Their hash only changes when the library version changes, so on a normal
        // app redeploy returning users re-fetch only the small index chunk, and the
        // browser can pull these in parallel.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('framer-motion') || id.includes('/motion-dom/') || id.includes('/motion-utils/')) {
            return 'vendor-framer';
          }
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('@tanstack')) return 'vendor-query';
          if (
            id.includes('/node_modules/react-dom/') ||
            id.includes('/node_modules/react/') ||
            id.includes('/node_modules/react-router') ||
            id.includes('/node_modules/@remix-run/router') ||
            id.includes('/node_modules/scheduler/')
          ) {
            return 'vendor-react';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
