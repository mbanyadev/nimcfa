import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'

const serverSrc = fileURLToPath(new URL('../server/src/', import.meta.url))

/**
 * Bundles the server's order engine into the app for demo mode (see src/demo.ts). `nimcfa-engine` is
 * server/src/main.browser.ts; inside server/src the Node-only pieces are swapped for browser ones:
 * store.ts → store.browser.ts (localStorage), @nimiq/core → the web WASM build, dotenv → nothing,
 * and process.env is read from globalThis.__NIMCFA_ENV__ (main.browser.ts fills it at runtime).
 * The rest (app.ts routes, orders.ts, pricing.ts, the simulator) is the same code the server runs.
 */
function browserEngine(): Plugin {
  return {
    name: 'nimcfa-browser-engine',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source === 'nimcfa-engine') return `${serverSrc}main.browser.ts`
      if (!importer?.startsWith(serverSrc)) return null
      if (source === './store.ts') return `${serverSrc}store.browser.ts`
      if (source === '@nimiq/core') return `${serverSrc}nimiq-core.browser.ts`
      if (source === 'dotenv/config') return '\0nimcfa-empty'
      return null
    },
    load(id) { return id === '\0nimcfa-empty' ? 'export {}' : null },
    // Vite replaces `process.env` with `{}` in browser builds; the engine sets real values at runtime instead.
    transform(code, id) {
      if (!id.startsWith(serverSrc)) return null
      return code.replace(/(?<![\w.])process\.env\b/g, 'globalThis.__NIMCFA_ENV__')
    },
  }
}

// host: true so Nimiq Pay on a phone in the same Wi-Fi can load http://<lan-ip>:5173
export default defineConfig({
  // base './' so the build works from any sub-path (GitHub Pages: /nimcfa/)
  base: './',
  plugins: [react(), browserEngine()],
  // The engine's @nimiq/core WASM module uses top-level await.
  build: { target: 'es2022' },
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': 'http://localhost:8787' },
    fs: { allow: ['..'] },
  },
})
