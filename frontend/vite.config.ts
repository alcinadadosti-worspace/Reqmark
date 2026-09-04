import { fileURLToPath, URL } from 'node:url';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  /**
   * As variáveis vêm do `.env` da RAIZ do repositório, não de `frontend/`.
   * Assim um arquivo só configura o build do app e a execução do backend —
   * que é como o serviço único do Render funciona. Variáveis já presentes no
   * ambiente (o painel do Render) continuam tendo precedência.
   */
  envDir: fileURLToPath(new URL('..', import.meta.url)),

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'logo-am.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        // O Firestore e o Slack precisam da rede; nunca servir da cache.
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: 'AM Marketing — Requisições de materiais',
        short_name: 'AM Marketing',
        description:
          'Requisições de itens do Marketing do Grupo Alcina Maria: veja o que está livre e peça em um minuto.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0B0B0D',
        theme_color: '#0B0B0D',
        categories: ['business', 'productivity'],
        icons: [
          { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/pwa-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Separa as bibliotecas pesadas para que nao entrem no bundle inicial:
        // o mapa e o WebGL so sao baixados na tela que realmente os usa.
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-motion': ['motion/react'],
          'vendor-map': ['leaflet', 'react-leaflet'],
          'vendor-webgl': ['ogl'],
          'vendor-calendar': ['react-day-picker', 'date-fns'],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    globals: false,
  },
});
