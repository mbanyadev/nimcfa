import type { MobileMoneyProvider, ProviderStatus } from './types.ts'

/**
 * Local stand-in for a mobile money API, used for development without any provider account.
 * Mirrors Fapshi's sandbox rules: numbers ending in 1 or 3 fail, everything else succeeds after a few seconds.
 * Stateless on purpose: the outcome and start time are encoded in the reference, so it gives the same answer
 * after a restart or on another serverless instance.
 */
const DELAY = 4000

function ref(kind: 'PO' | 'CO', phone: string) {
  const fail = /[13]$/.test(phone) ? 'F' : 'S'
  return `SIM-${kind}-${Date.now().toString(36)}-${fail}${crypto.randomUUID().slice(0, 6)}`
}

export const simulator: MobileMoneyProvider = {
  name: 'simulator',
  sandbox: true,
  async payout({ phone }) { return { ref: ref('PO', phone), status: 'pending' } },
  async collect({ phone }) { return { ref: ref('CO', phone) } },
  async status(r): Promise<ProviderStatus> {
    const m = /^SIM-(?:PO|CO)-([0-9a-z]+)-([FS])/.exec(r)
    if (!m) return 'failed'
    if (Date.now() - parseInt(m[1], 36) < DELAY) return 'pending'
    return m[2] === 'F' ? 'failed' : 'successful'
  },
}
