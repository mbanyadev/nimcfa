/**
 * End-to-end check against a running server on testnet:
 *  1. funds a throwaway "user" wallet from the treasury,
 *  2. cash-out: user sends NIM with the order memo -> payout -> paid (or refund for a failing number),
 *  3. top-up: mobile money collect -> NIM delivered to the user.
 * Usage: npm run e2e [-- 670000000]
 */
import 'dotenv/config'
import * as Nimiq from '@nimiq/core'
import { rpc, sendNim } from '../src/nimiq.ts'

const API = process.env.E2E_API ?? 'http://localhost:8787'
const phone = process.argv[2] ?? '670000000'
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {})
  const j = await r.json()
  if (!r.ok) throw new Error(`${path}: ${JSON.stringify(j)}`)
  return j as T
}

async function waitFor(id: string, done: string[]) {
  for (let i = 0; i < 90; i++) {
    const o = await api<{ status: string, timeline: { label: string, ref?: string }[], error?: string }>(`/api/orders/${id}`)
    if (done.includes(o.status)) return o
    await sleep(3000)
  }
  throw new Error(`order ${id} did not finish`)
}

const user = Nimiq.KeyPair.generate()
const userAddr = user.toAddress().toUserFriendlyAddress()
console.log('Test user wallet:', userAddr)
console.log('Funding from treasury:', await sendNim(userAddr, 5_000 * 100_000, 'NIMCFA e2e funding'))
for (let i = 0; i < 30; i++) {
  const a = await rpc<{ balance: number }>('getAccountByAddress', [userAddr])
  if (a.balance > 0) break
  await sleep(2000)
}

// --- Cash-out ---
const order = await api<{ id: string, memo: string, nimLuna: number, depositAddress: string, xaf: number }>('/api/offramp', { xaf: 300, phone, userAddress: userAddr })
console.log(`Cash-out ${order.id}: send ${order.nimLuna / 1e5} NIM -> ${order.xaf} FCFA to ${phone}`)
const height = await rpc<number>('getBlockNumber')
const tx = Nimiq.TransactionBuilder.newBasicWithData(user.toAddress(), Nimiq.Address.fromUserFriendlyAddress(order.depositAddress),
  new TextEncoder().encode(order.memo), BigInt(order.nimLuna), 0n, height, Number(process.env.NIM_NETWORK === 'mainnet' ? 24 : 5))
tx.sign(user, undefined)
const hash = await rpc<string>('sendRawTransaction', [tx.toHex()])
await api(`/api/offramp/${order.id}/deposit`, { txHash: hash })
const done = await waitFor(order.id, ['paid', 'refunded', 'payout_failed', 'expired'])
console.log('Cash-out result:', done.status, done.error ?? '')
for (const t of done.timeline) console.log('  -', t.label, t.ref ?? '')

// --- Top-up ---
const on = await api<{ id: string, nimLuna: number }>('/api/onramp', { xaf: 200, phone, userAddress: userAddr })
console.log(`Top-up ${on.id}: pay 200 FCFA -> ${on.nimLuna / 1e5} NIM`)
const onDone = await waitFor(on.id, ['delivered', 'payment_failed', 'expired'])
console.log('Top-up result:', onDone.status)
for (const t of onDone.timeline) console.log('  -', t.label, t.ref ?? '')
process.exit(0)
