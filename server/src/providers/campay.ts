import { config } from '../config.ts'
import type { MobileMoneyProvider, ProviderStatus } from './types.ts'

/** CamPay (Cameroon). DEV: https://demo.campay.net/api (max 25 XAF per transaction), PROD: https://app.campay.net/api */
async function call<T>(path: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
  if (!config.campay.token) throw new Error('CAMPAY_TOKEN is not configured')
  const r = await fetch(`${config.campay.baseUrl}${path}`, {
    method,
    headers: { Authorization: `Token ${config.campay.token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  })
  const j = await r.json().catch(() => ({})) as T & { message?: string }
  if (!r.ok) throw new Error(`CamPay ${path} HTTP ${r.status}: ${j.message ?? 'error'}`)
  return j
}

const map = (s: string): ProviderStatus => s === 'SUCCESSFUL' ? 'successful' : s === 'FAILED' ? 'failed' : 'pending'

export const campay: MobileMoneyProvider = {
  name: 'campay',
  get sandbox() { return config.campay.baseUrl.includes('demo') },
  async payout({ amount, phone, externalId, message }) {
    const j = await call<{ reference: string, status?: string }>('/withdraw/', 'POST', {
      amount: String(amount), currency: 'XAF', to: `237${phone}`, description: message, external_reference: externalId,
    })
    return { ref: j.reference, status: map(j.status ?? 'PENDING') }
  },
  async collect({ amount, phone, externalId, message }) {
    const j = await call<{ reference: string }>('/collect/', 'POST', {
      amount: String(amount), currency: 'XAF', from: `237${phone}`, description: message, external_reference: externalId,
    })
    return { ref: j.reference }
  },
  async status(ref) {
    const j = await call<{ status: string }>(`/transaction/${encodeURIComponent(ref)}/`, 'GET')
    return map(j.status)
  },
}
