import * as Nimiq from '@nimiq/core'
import { config } from './config.ts'

let rpcId = 0
export async function rpc<T>(method: string, params: unknown[] = []): Promise<T> {
  const r = await fetch(config.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
    signal: AbortSignal.timeout(15_000),
  })
  const j = await r.json() as { result?: { data: T }, error?: unknown }
  if (j.error !== undefined) throw new Error(`${method}: ${typeof j.error === 'string' ? j.error : JSON.stringify(j.error)}`)
  return j.result!.data
}

export interface ChainTx {
  hash: string
  blockNumber: number
  confirmations: number
  from: string
  to: string
  value: number
  fee: number
  recipientData: string
  executionResult: boolean
  networkId: number
  timestamp: number
}

export function normalizeAddress(addr: string): string {
  return Nimiq.Address.fromUserFriendlyAddress(addr.trim()).toUserFriendlyAddress()
}

export function isValidAddress(addr: string): boolean {
  try { normalizeAddress(addr); return true }
  catch { return false }
}

export function decodeData(hex: string): string {
  if (!hex) return ''
  const bytes = new Uint8Array((hex.match(/../g) ?? []).map(b => parseInt(b, 16)))
  return new TextDecoder().decode(bytes)
}

let treasury: Nimiq.KeyPair | null = null
export function getTreasury(): Nimiq.KeyPair {
  if (!treasury) {
    if (!config.treasuryPrivateKey) throw new Error('TREASURY_PRIVATE_KEY is not set (run npm run init:treasury)')
    treasury = Nimiq.KeyPair.derive(Nimiq.PrivateKey.fromHex(config.treasuryPrivateKey))
  }
  return treasury
}

export function treasuryAddress(): string {
  return getTreasury().toAddress().toUserFriendlyAddress()
}

export async function getBalanceLuna(address: string): Promise<number> {
  const acc = await rpc<{ balance: number }>('getAccountByAddress', [address])
  return acc.balance
}

export async function getTx(hash: string): Promise<ChainTx | null> {
  try { return await rpc<ChainTx>('getTransactionByHash', [hash]) }
  catch (e) {
    if (String(e).includes('not found')) return null
    throw e
  }
}

export async function getRecentTxs(address: string, max = 50): Promise<ChainTx[]> {
  return rpc<ChainTx[]>('getTransactionsByAddress', [address, max, null])
}

/** Sign locally with the treasury key and broadcast. Returns the transaction hash. */
export async function sendNim(to: string, luna: number, memo: string): Promise<string> {
  const kp = getTreasury()
  const height = await rpc<number>('getBlockNumber')
  const tx = Nimiq.TransactionBuilder.newBasicWithData(
    kp.toAddress(),
    Nimiq.Address.fromUserFriendlyAddress(to),
    new TextEncoder().encode(memo.slice(0, 64)),
    BigInt(luna),
    0n,
    height,
    config.networkId,
  )
  tx.sign(kp, undefined)
  return rpc<string>('sendRawTransaction', [tx.toHex()])
}
