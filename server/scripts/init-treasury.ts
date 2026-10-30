/**
 * Creates a fresh treasury key in server/.env (git-ignored) and, on testnet, funds it from the public faucet.
 * Mainnet keys must be created and funded by the operator, never committed.
 */
import * as Nimiq from '@nimiq/core'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

const envPath = new URL('../.env', import.meta.url).pathname
let env = existsSync(envPath) ? readFileSync(envPath, 'utf8') : readFileSync(new URL('../.env.example', import.meta.url).pathname, 'utf8')

if (/^TREASURY_PRIVATE_KEY=\S+/m.test(env)) {
  console.log('TREASURY_PRIVATE_KEY already set; leaving it alone.')
}
else {
  const kp = Nimiq.KeyPair.generate()
  env = env.replace(/^TREASURY_PRIVATE_KEY=.*$/m, `TREASURY_PRIVATE_KEY=${kp.privateKey.toHex()}`)
  writeFileSync(envPath, env, { mode: 0o600 })
  console.log('New treasury address:', kp.toAddress().toUserFriendlyAddress())
}

const key = /^TREASURY_PRIVATE_KEY=(\S+)/m.exec(env)![1]
const addr = Nimiq.KeyPair.derive(Nimiq.PrivateKey.fromHex(key)).toAddress().toUserFriendlyAddress()
const network = /^NIM_NETWORK=(\S+)/m.exec(env)?.[1] ?? 'testnet'
if (network === 'testnet') {
  {
    const r = await fetch('https://faucet.pos.nimiq-testnet.com/tapit', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `address=${encodeURIComponent(addr)}`,
    })
    // The faucet allows one tap per IP per 24h (about 110,000 test NIM).
    console.log('Faucet:', r.status, (await r.text()).slice(0, 120))
  }
}
console.log('Treasury:', addr)
