/**
 * Demo mode: when no server is configured (the hosted build on GitHub Pages), NimCFA runs its order engine
 * (server/src/main.browser.ts: quotes, escrow checks, simulated MoMo payouts, refunds, NIM delivery) inside
 * this page, on Nimiq TESTNET only. Production points the app at the real server (VITE_API_URL or ?api=).
 */
import type { BrowserEngine } from 'nimcfa-engine'

/**
 * PUBLIC, TESTNET-ONLY demo treasury key (NQ86 4MK6 6CG9 6MYY CU5D 1RQA ED9Q FT9M N39R).
 * It ships in this page on purpose so the hosted demo needs no server. It holds only free faucet test NIM,
 * has never been used on mainnet, and must never be. Production keys live only in the server environment.
 */
export const DEMO_TREASURY_KEY_TESTNET_ONLY = '56a161d5ae7c3a49087cf9b63401bad4cf5519dd073cbdfd21811b73853a2f57'

const WALLET_KEY = 'nimcfa.demo.walletKey'
let engine: Promise<BrowserEngine> | null = null

export function demoEngine(): Promise<BrowserEngine> {
  return engine ??= import('nimcfa-engine').then(async ({ startBrowserEngine }) => {
    const e = await startBrowserEngine({
      treasuryKey: DEMO_TREASURY_KEY_TESTNET_ONLY,
      walletKey: localStorage.getItem(WALLET_KEY),
      log: m => console.info('[NimCFA demo]', m),
    })
    localStorage.setItem(WALLET_KEY, e.walletKey)
    return e
  })
}
