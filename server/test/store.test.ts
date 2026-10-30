import { test } from 'node:test'
import assert from 'node:assert/strict'
process.env.STORE = 'memory'
process.env.FIXED_XAF_PER_NIM = '0.2'
const { initStore, store } = await import('../src/store.ts')
const { simulator } = await import('../src/providers/simulator.ts')

test('memory store: put, get, all, copies', async () => {
  await initStore()
  const o = { id: 'ABC', kind: 'onramp', status: 'awaiting_payment', timeline: [] } as any
  await store.put(o)
  const got = (await store.get('ABC'))!
  assert.equal(got.status, 'awaiting_payment')
  got.status = 'delivered' as any
  assert.equal((await store.get('ABC'))!.status, 'awaiting_payment', 'callers get copies, not the stored object')
  assert.equal((await store.all()).length, 1)
})

test('order lock is exclusive until released', async () => {
  assert.equal(await store.lock('ABC', 10_000), true)
  assert.equal(await store.lock('ABC', 10_000), false)
  await store.unlock('ABC')
  assert.equal(await store.lock('ABC', 10_000), true)
  await store.unlock('ABC')
})

test('simulator is stateless and follows the sandbox rules', async () => {
  const ok = await simulator.payout({ amount: 100, phone: '670000000', operator: 'mtn', externalId: 'x', message: '' })
  const ko = await simulator.collect({ amount: 100, phone: '670000001', operator: 'mtn', externalId: 'y', message: '' })
  assert.equal(await simulator.status(ok.ref, 'payout'), 'pending')
  const old = (r: string) => r.replace(/-([0-9a-z]+)-/, `-${(Date.now() - 5000).toString(36)}-`)
  assert.equal(await simulator.status(old(ok.ref), 'payout'), 'successful')
  assert.equal(await simulator.status(old(ko.ref), 'collect'), 'failed')
  assert.equal(await simulator.status('nonsense', 'payout'), 'failed')
})
