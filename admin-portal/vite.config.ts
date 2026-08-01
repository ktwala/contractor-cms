import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Proxy target: backend API for browser /v1 calls.
  // Docker Compose maps the Nest app to host port 4000 (see docker-compose.yml `app`).
  // Local `nest start` without Docker still defaults to PORT=3000 — set VITE_PROXY_TARGET=http://localhost:3000 in admin-portal/.env.
  const apiTarget = env.VITE_PROXY_TARGET || 'http://localhost:4000'

  return {
    plugins: [react()],
    server: {
      port: 3001,
      host: true,
      proxy: {
        '/v1': {
          target: apiTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})
