import { config } from './config.js'

/** The CFA franc (XAF) is pegged to the euro: 1 EUR = 655.957 XAF, fixed by treaty. */
export const XAF_PER_EUR = 655.957
export const LUNA_PER_NIM = 100_000

let cache: { xafPerNim: number, at: number, source: string } | null = null

export async function getXafPerNim(): Promise<{ xafPerNim: number, source: string, at: number }> {
  if (config.fixedXafPerNim) return { xafPerNim: config.fixedXafPerNim, source: 'fixed', at: Date.now() }
  if (cache && Date.now() - cache.at < 60_000) return cache
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=nimiq-2&vs_currencies=eur', {
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) throw new Error(`CoinGecko HTTP ${r.status}`)
    const j = await r.json() as { 'nimiq-2'?: { eur?: number } }
    const eur = j['nimiq-2']?.eur
    if (!eur || eur <= 0) throw new Error('CoinGecko returned no NIM/EUR price')
    cache = { xafPerNim: eur * XAF_PER_EUR, at: Date.now(), source: 'coingecko NIM/EUR x 655.957' }
    return cache
  }
  catch (e) {
    // Serve a recent price for up to 15 minutes if CoinGecko is briefly down; otherwise refuse to quote.
    if (cache && Date.now() - cache.at < 15 * 60_000) return cache
    throw e
  }
}

export interface Quote {
  direction: 'offramp' | 'onramp'
  nimLuna: number
  xaf: number
  feeXaf: number
  xafPerNim: number
  priceSource: string
  expiresAt: number
}

/** Cash-out: the user sends `nimLuna`, receives `xaf` (whole francs, rounded down) after the fee. */
export async function quoteOfframpFromXaf(xafWanted: number): Promise<Quote> {
  const { xafPerNim, source } = await getXafPerNim()
  const xaf = Math.floor(xafWanted)
  const gross = xaf / (1 - config.offrampFeeBps / 10_000)
  const nimLuna = Math.ceil((gross / xafPerNim) * LUNA_PER_NIM)
  return {
    direction: 'offramp', nimLuna, xaf, feeXaf: Math.ceil(gross - xaf), xafPerNim, priceSource: source,
    expiresAt: Date.now() + config.quoteTtlSeconds * 1000,
  }
}

/** Top-up: the user pays `xaf` by mobile money and receives `nimLuna` after the fee. */
export async function quoteOnramp(xafPaid: number): Promise<Quote> {
  const { xafPerNim, source } = await getXafPerNim()
  const xaf = Math.floor(xafPaid)
  const net = xaf * (1 - config.onrampFeeBps / 10_000)
  const nimLuna = Math.floor((net / xafPerNim) * LUNA_PER_NIM)
  return {
    direction: 'onramp', nimLuna, xaf, feeXaf: Math.ceil(xaf - net), xafPerNim, priceSource: source,
    expiresAt: Date.now() + config.quoteTtlSeconds * 1000,
  }
}
