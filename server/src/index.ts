import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import { config, isSandbox } from './config.js'
import { getTx, isValidAddress, normalizeAddress, treasuryAddress, getBalanceLuna } from './nimiq.js'
import { availableLiquidityLuna, memoFor, newOrderId, startWorker, step } from './orders.js'
import { detectOperator, maskPhone, normalizeCmPhone } from './phone.js'
import { getXafPerNim, quoteOfframpFromXaf, quoteOnramp } from './pricing.js'
import { getProvider } from './providers/index.js'
import { store } from './store.js'
import { mountDevWallet } from './devwallet.js'
import type { OfframpOrder, OnrampOrder, Order } from './types.js'

const app = new Hono()
app.use('/api/*', cors({ origin: config.allowedOrigins.includes('*') ? '*' : config.allowedOrigins }))

const bad = (msg: string, status: 400 | 404 | 409 | 503 = 400) => new Response(JSON.stringify({ error: msg }), {
  status, headers: { 'content-type': 'application/json' },
})

/** Never return the full phone number to the client. */
function publicOrder(o: Order) {
  return { ...o, phone: maskPhone(o.phone), explorer: config.explorer }
}

app.get('/api/health', async (c) => {
  const [price, bal] = await Promise.allSettled([getXafPerNim(), getBalanceLuna(treasuryAddress())])
  return c.json({
    ok: true,
    network: config.network,
    provider: getProvider().name,
    sandbox: isSandbox,
    depositAddress: treasuryAddress(),
    treasuryLuna: bal.status === 'fulfilled' ? bal.value : null,
    xafPerNim: price.status === 'fulfilled' ? price.value.xafPerNim : null,
    limits: { minXaf: config.minXaf, maxXaf: config.maxXaf },
    fees: { offrampBps: config.offrampFeeBps, onrampBps: config.onrampFeeBps },
  })
})

const quoteQ = z.object({ direction: z.enum(['offramp', 'onramp']), xaf: z.coerce.number().int().positive() })
app.get('/api/quote', async (c) => {
  const q = quoteQ.safeParse(c.req.query())
  if (!q.success) return bad('direction and xaf are required')
  const { direction, xaf } = q.data
  if (xaf < config.minXaf || xaf > config.maxXaf) return bad(`Amount must be between ${config.minXaf} and ${config.maxXaf} FCFA`)
  return c.json(direction === 'offramp' ? await quoteOfframpFromXaf(xaf) : await quoteOnramp(xaf))
})

const orderBody = z.object({
  xaf: z.number().int().positive(),
  phone: z.string().min(9).max(20),
  userAddress: z.string().refine(isValidAddress, 'Not a valid Nimiq address'),
})

function parseOrder(body: unknown) {
  const b = orderBody.safeParse(body)
  if (!b.success) return { error: b.error.issues[0]?.message ?? 'Invalid request' } as const
  const phone = normalizeCmPhone(b.data.phone)
  if (!phone) return { error: 'Enter a Cameroon mobile number, e.g. 6 70 00 00 00' } as const
  const operator = detectOperator(phone)
  if (!operator) return { error: 'This number is not an MTN or Orange number' } as const
  if (b.data.xaf < config.minXaf || b.data.xaf > config.maxXaf)
    return { error: `Amount must be between ${config.minXaf} and ${config.maxXaf} FCFA` } as const
  return { ...b.data, phone, operator, userAddress: normalizeAddress(b.data.userAddress) } as const
}

app.post('/api/offramp', async (c) => {
  const p = parseOrder(await c.req.json().catch(() => null))
  if ('error' in p) return bad(p.error!)
  const q = await quoteOfframpFromXaf(p.xaf)
  const id = newOrderId()
  const o: OfframpOrder = {
    id, kind: 'offramp', status: 'awaiting_deposit', memo: memoFor(id),
    createdAt: Date.now(), updatedAt: Date.now(), expiresAt: q.expiresAt,
    network: config.network, sandbox: isSandbox,
    phone: p.phone, operator: p.operator, userAddress: p.userAddress,
    xaf: q.xaf, feeXaf: q.feeXaf, nimLuna: q.nimLuna, xafPerNim: q.xafPerNim,
    depositAddress: treasuryAddress(),
    timeline: [{ at: Date.now(), label: `Rate locked: 1 NIM = ${q.xafPerNim.toFixed(4)} FCFA` }],
  }
  store.put(o)
  return c.json(publicOrder(o), 201)
})

app.post('/api/offramp/:id/deposit', async (c) => {
  const o = store.get(c.req.param('id'))
  if (!o || o.kind !== 'offramp') return bad('Order not found', 404)
  const body = z.object({ txHash: z.string().regex(/^[0-9a-f]{64}$/i) }).safeParse(await c.req.json().catch(() => null))
  if (!body.success) return bad('txHash must be a 64-character hex hash')
  if (o.status !== 'awaiting_deposit') return c.json(publicOrder(o))
  o.depositTx = body.data.txHash.toLowerCase()
  o.timeline.push({ at: Date.now(), label: 'Payment approved in Nimiq Pay, waiting for the network', ref: o.depositTx })
  store.put(o)
  void step(o)
  return c.json(publicOrder(o))
})

app.post('/api/onramp', async (c) => {
  const p = parseOrder(await c.req.json().catch(() => null))
  if ('error' in p) return bad(p.error!)
  const q = await quoteOnramp(p.xaf)
  if (await availableLiquidityLuna() < q.nimLuna) return bad('Not enough NIM liquidity right now. Try a smaller amount.', 409)
  const id = newOrderId()
  const o: OnrampOrder = {
    id, kind: 'onramp', status: 'awaiting_payment', memo: memoFor(id),
    createdAt: Date.now(), updatedAt: Date.now(), expiresAt: Date.now() + 15 * 60_000,
    network: config.network, sandbox: isSandbox,
    phone: p.phone, operator: p.operator, userAddress: p.userAddress,
    xaf: q.xaf, feeXaf: q.feeXaf, nimLuna: q.nimLuna, xafPerNim: q.xafPerNim,
    timeline: [{ at: Date.now(), label: `Rate locked: 1 NIM = ${q.xafPerNim.toFixed(4)} FCFA` }],
  }
  try {
    const r = await getProvider().collect({
      amount: o.xaf, phone: o.phone, operator: o.operator, externalId: o.id, message: `NimCFA top-up ${o.id}`,
    })
    o.collectRef = r.ref
    o.timeline.push({ at: Date.now(), label: 'Payment request sent to your phone. Dial the prompt to approve.', ref: r.ref })
  }
  catch (e) {
    return bad(`Could not reach the mobile money operator: ${(e as Error).message}`, 503)
  }
  store.put(o)
  return c.json(publicOrder(o), 201)
})

app.get('/api/orders/:id', (c) => {
  const o = store.get(c.req.param('id'))
  return o ? c.json(publicOrder(o)) : bad('Order not found', 404)
})

app.get('/api/orders', (c) => {
  const addr = c.req.query('address')
  if (!addr || !isValidAddress(addr)) return bad('address is required')
  const a = normalizeAddress(addr)
  const list = store.all().filter(o => o.userAddress === a).sort((x, y) => y.createdAt - x.createdAt).slice(0, 50)
  return c.json(list.map(publicOrder))
})

app.get('/api/tx/:hash', async (c) => c.json(await getTx(c.req.param('hash'))))

mountDevWallet(app)
startWorker()
serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(`NimCFA server on :${info.port} | ${config.network} | provider=${getProvider().name}${isSandbox ? ' (sandbox)' : ''}`)
  console.log(`Escrow/treasury address: ${treasuryAddress()}`)
})
