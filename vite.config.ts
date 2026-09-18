import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// base は './' 固定。配信先（ルート / サブパス）が決まっていないため、
// clips.json の src も 'clips/xxx.mp4' の相対形式で保持し、実行時に BASE_URL と連結する。
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // macOS の Docker バインドマウントは inotify を取りこぼすため polling が必要
    watch: { usePolling: true, interval: 300 },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
