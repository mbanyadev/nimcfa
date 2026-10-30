import * as Nimiq from '@nimiq/core'
import type { Hono } from 'hono'
import { config } from './config.js'
import { rpc } from './nimiq.js'

/**
 * Browser-preview wallet, for testing the mini app outside Nimiq Pay (desktop browser, CI, screenshots).
 * Only mounted when ENABLE_DEV_WALLET=true AND the network is testnet. It is never available on mainnet.
 */
export function mountDevWallet(app: Hono) {
  if (process.env.ENABLE_DEV_WALLET !== 'true' || config.network !== 'testnet') return
  const key = process.env.DEV_WALLET_PRIVATE_KEY
  if (!key) { console.warn('ENABLE_DEV_WALLET is set but DEV_WALLET_PRIVATE_KEY is empty'); return }
  const kp = Nimiq.KeyPair.derive(Nimiq.PrivateKey.fromHex(key))
  const address = kp.toAddress().toUserFriendlyAddress()
  console.log(`Dev wallet (testnet only): ${address}`)

  app.get('/api/dev/wallet', async (c) => {
    const acc = await rpc<{ balance: number }>('getAccountByAddress', [address])
    return c.json({ address, balance: acc.balance })
  })
  app.post('/api/dev/send', async (c) => {
    const b = await c.req.json() as { recipient: string, value: number, data?: string }
    const height = await rpc<number>('getBlockNumber')
    const tx = Nimiq.TransactionBuilder.newBasicWithData(
      kp.toAddress(), Nimiq.Address.fromUserFriendlyAddress(b.recipient),
      new TextEncoder().encode(b.data ?? ''), BigInt(b.value), 0n, height, config.networkId,
    )
    tx.sign(kp, undefined)
    return c.json({ hash: await rpc<string>('sendRawTransaction', [tx.toHex()]) })
  })
}
