import { config } from './config.js'
import { decodeData, getBalanceLuna, getRecentTxs, getTx, sendNim, treasuryAddress, type ChainTx } from './nimiq.js'
import { getProvider } from './providers/index.js'
import { store } from './store.js'
import type { OfframpOrder, OnrampOrder, Order } from './types.js'
import { LUNA_PER_NIM } from './pricing.js'

const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
export function newOrderId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return [...bytes].map(b => ALPHABET[b % ALPHABET.length]).join('')
}

export const memoFor = (id: string) => `NIMCFA ${id}`

function log(o: Order, label: string, ref?: string) {
  o.timeline.push({ at: Date.now(), label, ref })
}

const busy = new Set<string>()

/** Check one transaction against an off-ramp order. Returns a reason if it does not match. */
export function checkDeposit(o: OfframpOrder, tx: ChainTx): string | null {
  if (tx.networkId !== config.networkId) return 'wrong network'
  if (tx.to !== o.depositAddress) return 'sent to the wrong address'
  if (decodeData(tx.recipientData) !== o.memo) return 'memo does not match this order'
  if (!tx.executionResult) return 'transaction failed on chain'
  if (tx.from !== o.userAddress) return 'sent from a different wallet than the one that created the order'
  if (tx.value < o.nimLuna) return `amount too low (got ${tx.value / LUNA_PER_NIM} NIM, need ${o.nimLuna / LUNA_PER_NIM} NIM)`
  return null
}

async function refund(o: OfframpOrder, to: string, luna: number, why: string) {
  o.status = 'refunding'; o.error = why
  log(o, `Refunding ${luna / LUNA_PER_NIM} NIM: ${why}`)
  store.put(o)
  o.refundTx = await sendNim(to, luna, `${o.memo} refund`)
  o.status = 'refunded'
  log(o, 'NIM refunded to your wallet', o.refundTx)
  store.put(o)
}

async function stepOfframp(o: OfframpOrder) {
  const provider = getProvider()

  if (o.status === 'awaiting_deposit') {
    // Find the deposit either from the hash the app reported or by scanning the escrow address for the memo.
    let tx: ChainTx | null = o.depositTx ? await getTx(o.depositTx) : null
    if (!tx) {
      const recent = await getRecentTxs(o.depositAddress, 100)
      tx = recent.find(t => t.to === o.depositAddress && decodeData(t.recipientData) === o.memo) ?? null
    }
    if (!tx) {
      if (Date.now() > o.expiresAt) { o.status = 'expired'; log(o, 'Quote expired before any NIM arrived'); store.put(o) }
      return
    }
    if (tx.confirmations < config.minConfirmations) return
    o.depositTx = tx.hash
    const bad = checkDeposit(o, tx)
    if (bad) {
      // Only refund what we can attribute: NIM that reached the escrow with this order's memo.
      if (tx.to === o.depositAddress && tx.executionResult && tx.value > 0) await refund(o, tx.from, tx.value, bad)
      else { o.status = 'payout_failed'; o.error = bad; store.put(o) }
      return
    }
    if (tx.timestamp > o.expiresAt + 60_000) {
      await refund(o, tx.from, tx.value, 'NIM arrived after the locked rate expired')
      return
    }
    o.status = 'deposit_seen'
    log(o, `Received ${tx.value / LUNA_PER_NIM} NIM on chain`, tx.hash)
    store.put(o)
  }

  if (o.status === 'deposit_seen') {
    o.status = 'paying_out'
    store.put(o)
    try {
      const r = await provider.payout({
        amount: o.xaf, phone: o.phone, operator: o.operator, externalId: o.id, message: `NimCFA cash-out ${o.id}`,
      })
      o.payoutRef = r.ref
      log(o, `${o.xaf.toLocaleString('fr-FR')} FCFA payout sent to ${o.operator === 'mtn' ? 'MTN MoMo' : 'Orange Money'}`, r.ref)
      store.put(o)
    }
    catch (e) {
      const msg = (e as Error).message
      // A clear 4xx means the provider refused it, so refunding is safe. Anything else (timeout, 5xx) may
      // still have paid out, and Fapshi has no idempotency, so park it for manual review instead of risking
      // paying twice.
      if (/HTTP 4\d\d/.test(msg)) await refund(o, o.userAddress, o.nimLuna, `payout refused: ${msg}`)
      else { o.status = 'payout_failed'; o.error = `needs manual review: ${msg}`; log(o, 'Payout status unknown, under review'); store.put(o) }
      return
    }
  }

  if (o.status === 'paying_out' && o.payoutRef) {
    const s = await provider.status(o.payoutRef, 'payout')
    if (s === 'successful') { o.status = 'paid'; log(o, 'Mobile money received'); store.put(o) }
    else if (s === 'failed') await refund(o, o.userAddress, o.nimLuna, 'the mobile money operator rejected the payout')
  }
}

async function stepOnramp(o: OnrampOrder) {
  const provider = getProvider()
  if (o.status === 'awaiting_payment' && o.collectRef) {
    const s = await provider.status(o.collectRef, 'collect')
    if (s === 'failed') { o.status = 'payment_failed'; log(o, 'Mobile money payment was not completed'); store.put(o); return }
    if (s === 'pending') {
      if (Date.now() > o.expiresAt) { o.status = 'expired'; log(o, 'Payment prompt expired'); store.put(o) }
      return
    }
    o.status = 'paid_in'
    log(o, `${o.xaf.toLocaleString('fr-FR')} FCFA received`, o.collectRef)
    store.put(o)
  }
  if (o.status === 'paid_in') {
    o.status = 'sending_nim'
    store.put(o)
    o.deliveryTx = await sendNim(o.userAddress, o.nimLuna, o.memo)
    o.status = 'delivered'
    log(o, `${o.nimLuna / LUNA_PER_NIM} NIM sent to your wallet`, o.deliveryTx)
    store.put(o)
  }
}

export async function step(o: Order) {
  if (busy.has(o.id)) return
  busy.add(o.id)
  try {
    if (o.kind === 'offramp') await stepOfframp(o)
    else await stepOnramp(o)
  }
  catch (e) {
    o.error = (e as Error).message
    store.put(o)
    console.error(`[order ${o.id}]`, e)
  }
  finally { busy.delete(o.id) }
}

const OPEN = new Set(['awaiting_deposit', 'deposit_seen', 'paying_out', 'awaiting_payment', 'paid_in'])

export function startWorker(intervalMs = 4000) {
  const tick = async () => {
    const open = store.all().filter(o => OPEN.has(o.status))
    await Promise.all(open.map(step))
  }
  setInterval(() => { tick().catch(e => console.error('[worker]', e)) }, intervalMs)
}

/** NIM the treasury has not already promised to someone (pending top-ups). */
export async function availableLiquidityLuna(): Promise<number> {
  const bal = await getBalanceLuna(treasuryAddress())
  const reserved = store.all()
    .filter((o): o is OnrampOrder => o.kind === 'onramp' && ['awaiting_payment', 'paid_in', 'sending_nim'].includes(o.status))
    .reduce((s, o) => s + o.nimLuna, 0)
  return bal - reserved
}
