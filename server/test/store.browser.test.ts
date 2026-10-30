import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LocalStore } from '../src/store.browser.ts'
import type { Order } from '../src/types.ts'

function fakeLocalStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v) }, removeItem: (k: string) => { m.delete(k) } }
}

const order = (id: string) => ({ id, kind: 'onramp', status: 'awaiting_payment', timeline: [] }) as unknown as Order

test('browser store keeps orders across instances sharing one localStorage (page reloads)', async () => {
  const ls = fakeLocalStorage()
  await new LocalStore(ls).put(order('A'))
  const again = new LocalStore(ls)
  assert.equal((await again.get('A'))?.id, 'A')
  assert.equal((await again.all()).length, 1)
})

test('browser store lock is shared across tabs and expires', async () => {
  const ls = fakeLocalStorage()
  const tab1 = new LocalStore(ls), tab2 = new LocalStore(ls)
  assert.equal(await tab1.lock('A', 50), true)
  assert.equal(await tab2.lock('A', 50), false)
  await tab1.unlock('A')
  assert.equal(await tab2.lock('A', 10), true)
  await new Promise(r => setTimeout(r, 20))
  assert.equal(await tab1.lock('A', 10), true)
})
