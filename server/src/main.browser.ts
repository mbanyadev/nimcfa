/**
 * Browser entry: runs the same order engine (app.ts, orders.ts, pricing.ts, the mobile money simulator) inside
 * the page, for the hosted demo on GitHub Pages where there is no server. It is TESTNET ONLY and refuses
 * anything else. The escrow key it uses is a public demo key that ships in the page, so the demo treasury
 * holds only faucet test NIM. Production runs the Node or Deno entry (index.ts, main.deno.ts) with the key
 * kept in the server environment.
 *
 * Requests go through `fetch(path)`, which calls the Hono app directly instead of the network.
 */
import { initStore } from './store.browser.ts'

export interface BrowserEngine {
  fetch(path: string, init?: RequestInit): Promise<Response>
  /** The page-local preview wallet key (hex). Generated on first run; testnet only. */
  walletKey: string
  walletAddress: string
  treasuryAddress: string
  /** Resolves once the preview wallet has test NIM to spend (faucet first, demo treasury as fallback). */
  fundWallet(): Promise<void>
}

const RPC = 'https://rpc.testnet.nimiqwatch.com/'
const FAUCET = 'https://faucet.pos.nimiq-testnet.com/tapit'
const WALLET_MIN_LUNA = 5_000 * 100_000
const WALLET_GRANT_LUNA = 15_000 * 100_000
const TREASURY_LOW_LUNA = 60_000 * 100_000

export async function startBrowserEngine(opts: {
  treasuryKey: string
  walletKey?: string | null
  workerIntervalMs?: number
  log?: (msg: string) => void
}): Promise<BrowserEngine> {
  const log = opts.log ?? (() => {})
  const Nimiq = await import('@nimiq/core')
  const walletKey = opts.walletKey || Nimiq.KeyPair.generate().privateKey.toHex()
  const env = {
    NIM_NETWORK: 'testnet',
    NIM_RPC_URL: RPC,
    PAYOUT_PROVIDER: 'simulator',
    TREASURY_PRIVATE_KEY: opts.treasuryKey,
    MIN_CONFIRMATIONS: '2',
    ALLOWED_ORIGINS: '*',
    ENABLE_DEV_WALLET: 'true',
    DEV_WALLET_PRIVATE_KEY: walletKey,
    WORKER_INTERVAL_MS: String(opts.workerIntervalMs ?? 4000),
  }
  // config.ts and devwallet.ts read process.env, which a browser does not have. The app's build rewrites
  // process.env in server/src to this global (Vite would otherwise inline it as {}).
  const g = globalThis as { __NIMCFA_ENV__?: Record<string, string | undefined> }
  g.__NIMCFA_ENV__ = { ...g.__NIMCFA_ENV__, ...env }

  await initStore()
  const { config } = await import('./config.ts')
  if (config.network !== 'testnet') throw new Error('The browser demo engine only runs on testnet')
  const { app } = await import('./app.ts')
  const { startWorker } = await import('./orders.ts')
  const { getBalanceLuna, sendNim, treasuryAddress } = await import('./nimiq.ts')
  startWorker()

  const walletAddress = Nimiq.KeyPair.derive(Nimiq.PrivateKey.fromHex(walletKey)).toAddress().toUserFriendlyAddress()
  const tap = async (address: string) => {
    const r = await fetch(FAUCET, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: `address=${encodeURIComponent(address)}`, signal: AbortSignal.timeout(10_000),
    })
    const j = await r.json().catch(() => ({})) as { success?: boolean, msg?: string }
    if (!r.ok || !j.success) throw new Error(j.msg ?? `faucet HTTP ${r.status}`)
  }
  const waitFor = async (address: string, min: number, ms: number) => {
    for (const end = Date.now() + ms; Date.now() < end; await new Promise(r => setTimeout(r, 1500)))
      if (await getBalanceLuna(address).catch(() => 0) >= min) return true
    return false
  }

  let funding: Promise<void> | null = null
  const fund = async () => {
    const treasury = treasuryAddress()
    // Keep the shared demo treasury topped up from the public testnet faucet (one tap per visitor IP per day).
    getBalanceLuna(treasury).then(b => b < TREASURY_LOW_LUNA ? tap(treasury) : undefined).catch(() => {})
    if (await getBalanceLuna(walletAddress).catch(() => 0) >= WALLET_MIN_LUNA) return
    try { await tap(walletAddress); log('Preview wallet funded from the testnet faucet') }
    catch {
      log('Faucet unavailable, funding the preview wallet from the demo treasury')
      await sendNim(walletAddress, WALLET_GRANT_LUNA, 'NimCFA demo wallet')
    }
    await waitFor(walletAddress, 1, 60_000)
  }

  return {
    fetch: (path, init) => Promise.resolve(app.fetch(new Request(new URL(path, 'https://nimcfa.demo'), init))),
    walletKey,
    walletAddress,
    treasuryAddress: treasuryAddress(),
    fundWallet: () => funding ??= fund().catch(e => { funding = null; throw e }),
  }
}
