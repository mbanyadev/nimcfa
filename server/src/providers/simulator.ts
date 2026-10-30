import type { MobileMoneyProvider, ProviderStatus } from './types.js'

/**
 * Local stand-in for a mobile money API, used for development without any provider account.
 * Mirrors Fapshi's sandbox rules: numbers ending in 1 or 3 fail, everything else succeeds after a few seconds.
 */
const txs = new Map<string, { at: number, fail: boolean }>()
const DELAY = 4000

export const simulator: MobileMoneyProvider = {
  name: 'simulator',
  sandbox: true,
  async payout({ phone }) {
    const ref = `SIM-PO-${crypto.randomUUID().slice(0, 8)}`
    txs.set(ref, { at: Date.now(), fail: /[13]$/.test(phone) })
    return { ref, status: 'pending' }
  },
  async collect({ phone }) {
    const ref = `SIM-CO-${crypto.randomUUID().slice(0, 8)}`
    txs.set(ref, { at: Date.now(), fail: /[13]$/.test(phone) })
    return { ref }
  },
  async status(ref): Promise<ProviderStatus> {
    const t = txs.get(ref)
    if (!t) return 'failed'
    if (Date.now() - t.at < DELAY) return 'pending'
    return t.fail ? 'failed' : 'successful'
  },
}
