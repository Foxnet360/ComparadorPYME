import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isProd = mode === 'production';
  
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: isProd ? undefined : {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
        '/health': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        }
      }
    },
    plugins: [react()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    optimizeDeps: {
      exclude: [
        'express',
        'cors',
        'multer',
        'ioredis',
        'pdf-parse',
        'sharp',
        'ws',
        'server',
      ]
    },
    build: {
      rollupOptions: {
        external: [
          'express',
          'cors',
          'multer',
          'ioredis',
          'pdf-parse',
          'sharp',
          'ws',
        ]
      }
    }
  };
});
