import { getHostLanguage, getHostNetwork, init, NimiqProviderError } from '@nimiq/mini-app-sdk'
import { call, DEMO } from './api'
import { demoEngine } from './demo'

export interface Wallet {
  mode: 'nimiqpay' | 'preview'
  network: 'mainnet' | 'testnet'
  listAccounts(): Promise<string[]>
  getBalance(address: string): Promise<number | null>
  /** Sends NIM with a text memo. Resolves to the transaction hash after the user approves. */
  send(tx: { recipient: string, value: number, data: string }): Promise<string>
}

export class UserCancelled extends Error {}

/** How the browser preview wallet asks the user to approve a send. The app swaps in its own sheet. */
type PreviewConfirm = (tx: { recipient: string, value: number, data: string }) => Promise<boolean>
let previewConfirm: PreviewConfirm = async tx => window.confirm(`Preview wallet (testnet)\n\nSend ${tx.value / 1e5} NIM to\n${tx.recipient}\nMemo: ${tx.data}`)
export function setPreviewConfirm(fn: PreviewConfirm) { previewConfirm = fn }

function isCancel(e: unknown) {
  if (NimiqProviderError.is(e)) return /denied|reject|cancel/i.test(`${e.message} ${(e as { code?: string }).code ?? ''}`)
  return /denied|reject|cancel/i.test(String((e as Error)?.message ?? e))
}

/**
 * Connect to Nimiq Pay. Outside Nimiq Pay, fall back to the testnet preview wallet if the server offers one
 * (in demo mode that wallet's key is generated and kept in this browser).
 */
export async function connectWallet(): Promise<Wallet | null> {
  try {
    const nimiq = await init({ timeout: 6000 })
    return {
      mode: 'nimiqpay',
      network: getHostNetwork() ?? 'mainnet',
      listAccounts: () => nimiq.listAccounts(),
      getBalance: async (a) => { try { return await nimiq.getBalance(a) } catch { return null } },
      async send({ recipient, value, data }) {
        try { return await nimiq.sendBasicTransactionWithData({ recipient, value, data }) }
        catch (e) { if (isCancel(e)) throw new UserCancelled('cancelled'); throw e }
      },
    }
  }
  catch {
    // Demo mode: wait until the page-local testnet wallet has test NIM (faucet, or the demo treasury).
    if (DEMO) await await (await demoEngine()).fundWallet().catch(() => {})
    const r = await call('/api/dev/wallet').catch(() => null)
    if (!r?.ok) return null
    return {
      mode: 'preview',
      network: 'testnet',
      listAccounts: async () => [(await (await call('/api/dev/wallet')).json()).address],
      getBalance: async () => (await (await call('/api/dev/wallet')).json()).balance,
      async send(tx) {
        if (!await previewConfirm(tx)) throw new UserCancelled('cancelled')
        const r = await call('/api/dev/send', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(tx) })
        if (!r.ok) throw new Error('Preview wallet could not send')
        return (await r.json()).hash
      },
    }
  }
}

export function hostLanguage(): 'fr' | 'en' {
  const l = getHostLanguage() ?? navigator.language
  return l?.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}
