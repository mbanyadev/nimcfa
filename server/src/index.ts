// Node entry: `npm start` (tsx). Uses the JSON file store unless STORE says otherwise.
import { serve } from '@hono/node-server'
import { config } from './config.ts'
import { initStore } from './store.ts'
import { startWorker } from './orders.ts'

await initStore()
const { app, banner } = await import('./app.ts')
startWorker()
serve({ fetch: app.fetch, port: config.port }, (info) => {
  banner()
  console.log(`Listening on :${info.port}`)
})
