/**
 * Server base URL. Build-time VITE_API_URL, optionally overridden at runtime with ?api=https://... (remembered),
 * so the same static build can point at a different NimCFA server without a rebuild.
 */
function resolveApi(): string {
  const fromBuild = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
  try {
    const q = new URLSearchParams(window.location.search).get('api')
    if (q !== null) {
      if (q === '' || q === 'default') localStorage.removeItem('nimcfa.api')
      else if (/^https?:\/\//.test(q)) localStorage.setItem('nimcfa.api', q)
    }
    return (localStorage.getItem('nimcfa.api') ?? fromBuild).replace(/\/$/, '')
  }
  catch { return fromBuild.replace(/\/$/, '') }
}
export const API = resolveApi()

export interface TimelineEvent { at: number, label: string, ref?: string }
export interface Order {
  id: string
  kind: 'offramp' | 'onramp'
  status: string
  memo: string
  createdAt: number
  expiresAt: number
  network: 'testnet' | 'mainnet'
  sandbox: boolean
  phone: string
  operator: 'mtn' | 'orange'
  xaf: number
  feeXaf: number
  nimLuna: number
  xafPerNim: number
  userAddress: string
  depositAddress?: string
  depositTx?: string
  payoutRef?: string
  refundTx?: string
  deliveryTx?: string
  timeline: TimelineEvent[]
  error?: string
  explorer: string
}
export interface Quote { nimLuna: number, xaf: number, feeXaf: number, xafPerNim: number, expiresAt: number }
export interface Health {
  network: 'testnet' | 'mainnet'
  provider: string
  sandbox: boolean
  depositAddress: string
  treasuryLuna: number | null
  xafPerNim: number | null
  limits: { minXaf: number, maxXaf: number }
}

async function req<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, body === undefined ? undefined : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  })
  const j = await r.json().catch(() => ({ error: `Server error (${r.status})` }))
  if (!r.ok) throw new Error(j.error ?? `Server error (${r.status})`)
  return j as T
}

export const api = {
  health: () => req<Health>('/api/health'),
  quote: (direction: 'offramp' | 'onramp', xaf: number) => req<Quote>(`/api/quote?direction=${direction}&xaf=${xaf}`),
  offramp: (b: { xaf: number, phone: string, userAddress: string }) => req<Order>('/api/offramp', b),
  reportDeposit: (id: string, txHash: string) => req<Order>(`/api/offramp/${id}/deposit`, { txHash }),
  onramp: (b: { xaf: number, phone: string, userAddress: string }) => req<Order>('/api/onramp', b),
  order: (id: string) => req<Order>(`/api/orders/${id}`),
  history: (address: string) => req<Order[]>(`/api/orders?address=${encodeURIComponent(address)}`),
}
