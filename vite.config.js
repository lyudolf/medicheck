import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      // 네이티브 전용 Capacitor 플러그인은 번들에서 제외
      external: [
        '@capacitor-firebase/analytics',
      ],
    },
  },
});
