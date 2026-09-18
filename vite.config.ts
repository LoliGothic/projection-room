import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base は './' 固定。配信先（ルート / サブパス）が決まっていないため、
// clips.json の src も 'clips/xxx.mp4' の相対形式で保持し、実行時に BASE_URL と連結する。
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: '映写室',
        short_name: '映写室',
        description: '本物の古い映画と、AIが生成した偽物を見分ける映写室のゲーム',
        lang: 'ja',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#000000',
        theme_color: '#050505',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // アプリ本体だけ事前キャッシュする。動画は実行時に少しずつ貯める
        globPatterns: ['**/*.{js,css,html,woff2}', 'icons/*.png', 'clips.json'],
        runtimeCaching: [
          {
            urlPattern: /\/clips\/.*\.mp4$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'projection-room-clips',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 30 },
              // 動画は 206 Partial Content で返ることがある
              rangeRequests: true,
              cacheableResponse: { statuses: [0, 200, 206] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // macOS の Docker バインドマウントは inotify を取りこぼすため polling が必要
    watch: { usePolling: true, interval: 300 },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    setupFiles: ['src/test/setup.ts'],
  },
})
