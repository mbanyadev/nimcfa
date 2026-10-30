import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// host: true so Nimiq Pay on a phone in the same Wi-Fi can load http://<lan-ip>:5173
export default defineConfig({
  // base './' so the build works from any sub-path (GitHub Pages: /nimcfa/)
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': 'http://localhost:8787' },
  },
})
