import { config } from '../config.js'
import type { MobileMoneyProvider, ProviderStatus } from './types.js'

/** Fapshi (Cameroon): MTN MoMo + Orange Money. Sandbox: https://sandbox.fapshi.com, live: https://live.fapshi.com */
async function call<T>(path: string, init: { method: 'GET' | 'POST', body?: unknown, kind: 'payout' | 'collect' }): Promise<T> {
  const f = config.fapshi
  const [user, key] = init.kind === 'payout' ? [f.payoutUser, f.payoutKey] : [f.collectUser, f.collectKey]
  if (!user || !key) throw new Error(`Fapshi ${init.kind} credentials are not configured`)
  const r = await fetch(`${f.baseUrl}${path}`, {
    method: init.method,
    headers: { apiuser: user, apikey: key, 'content-type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(30_000),
  })
  const j = await r.json().catch(() => ({})) as T & { message?: string }
  if (!r.ok) throw new Error(`Fapshi ${path} HTTP ${r.status}: ${j.message ?? 'error'}`)
  return j
}

const medium = (op: 'mtn' | 'orange') => op === 'mtn' ? 'mobile money' : 'orange money'

function map(s: string): ProviderStatus {
  if (s === 'SUCCESSFUL') return 'successful'
  if (s === 'FAILED' || s === 'EXPIRED') return 'failed'
  return 'pending'
}

export const fapshi: MobileMoneyProvider = {
  name: 'fapshi',
  get sandbox() { return config.fapshi.baseUrl.includes('sandbox') },
  async payout({ amount, phone, operator, externalId, message }) {
    const j = await call<{ transId: string }>('/payout', {
      method: 'POST', kind: 'payout',
      body: { amount, phone, medium: medium(operator), externalId, userId: externalId, message },
    })
    return { ref: j.transId, status: 'pending' }
  },
  async collect({ amount, phone, operator, externalId, message }) {
    const j = await call<{ transId: string }>('/direct-pay', {
      method: 'POST', kind: 'collect',
      body: { amount, phone, medium: medium(operator), externalId, userId: externalId, message },
    })
    return { ref: j.transId }
  },
  async status(ref, kind) {
    const j = await call<{ status: string }>(`/payment-status/${encodeURIComponent(ref)}`, { method: 'GET', kind })
    return map(j.status)
  },
}
