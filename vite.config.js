import { defineConfig } from 'vite';
import path from 'path';

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
  resolve: {
    alias: {
      // 웹 빌드에서 네이티브 전용 플러그인을 빈 shim으로 대체
      '@capacitor-firebase/analytics': path.resolve(__dirname, 'src/shims/firebase-analytics.js'),
    },
  },
});
