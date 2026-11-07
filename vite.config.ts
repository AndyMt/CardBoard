import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));
const buildNumber = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 12);

// https://vitejs.dev/config/
export default defineConfig(({ mode }): UserConfig => {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_NUMBER__: JSON.stringify(buildNumber),
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          // No rewrite needed as we're using the same path
        },
        // Forward the Socket.IO WebSocket handshake to the backend so
        // real-time updates work in dev mode (the client connects to the
        // page origin, which is the Vite dev server).
        '/socket.io': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          ws: true,
        },
      }
    },
    // Production optimizations
    build: {
      outDir: 'build',
      sourcemap: mode === 'development',
      minify: mode === 'production',
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
          },
        },
      },
    },
  };
});