// Deno entry, used on Deno Deploy (and `deno task start` locally).
// Orders live in Deno KV, the only storage that survives restarts and is shared by every instance.
// Serverless instances stop when idle, so orders are advanced three ways: a short in-process loop while
// the instance is warm, on every client poll (see app.ts), and a Deno.cron job that wakes the app every minute.
import { initStore } from './store.ts'
import { startWorker, tick } from './orders.ts'

await initStore()
const { app, banner } = await import('./app.ts')

declare const Deno: {
  serve(opts: { port?: number }, h: (r: Request) => Response | Promise<Response>): unknown
  cron?(name: string, schedule: string, fn: () => Promise<void>): unknown
  env: { get(k: string): string | undefined }
}

if (typeof Deno.cron === 'function') {
  Deno.cron('advance open orders', '* * * * *', async () => { await tick() })
}
startWorker()
banner()
Deno.serve({ port: Number(Deno.env.get('PORT') ?? 8000) }, app.fetch)
