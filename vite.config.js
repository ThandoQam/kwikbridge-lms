import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Sentry is an optional runtime dependency — externalize so build doesn't fail
    rollupOptions: {
      external: ['@sentry/react'],
      output: {
        // Code splitting for better caching
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
    // Source maps for production debugging via Sentry
    sourcemap: 'hidden',
  },
  server: {
    port: 5173,
    strictPort: false,
  },
})
