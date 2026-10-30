import type { Order } from './types.ts'
import type { OrderStore } from './store.ts'

/**
 * Browser order store for the in-browser demo engine (main.browser.ts). Same interface as store.ts, kept in
 * localStorage so a page reload does not lose orders. Locks also live in localStorage, so two open tabs of the
 * demo never advance (or pay out) the same order at once. The build swaps this in for store.ts in the browser.
 */
interface KV { getItem(k: string): string | null, setItem(k: string, v: string): void, removeItem(k: string): void }

function memoryKv(): KV {
  const m = new Map<string, string>()
  return { getItem: k => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v) }, removeItem: k => { m.delete(k) } }
}

export class LocalStore implements OrderStore {
  kind = 'browser'
  constructor(private kv: KV = (globalThis as { localStorage?: KV }).localStorage ?? memoryKv(), private prefix = 'nimcfa.demo.') {}
  private read(): Record<string, Order> {
    try { return JSON.parse(this.kv.getItem(`${this.prefix}orders`) ?? '{}') as Record<string, Order> }
    catch { return {} }
  }
  async get(id: string) { return this.read()[id] }
  async all() { return Object.values(this.read()) }
  async put(o: Order) {
    o.updatedAt = Date.now()
    const all = this.read()
    all[o.id] = structuredClone(o)
    this.kv.setItem(`${this.prefix}orders`, JSON.stringify(all))
    return o
  }
  async lock(id: string, ttlMs: number) {
    const key = `${this.prefix}lock.${id}`
    const until = Number(this.kv.getItem(key) ?? 0)
    if (until > Date.now()) return false
    this.kv.setItem(key, String(Date.now() + ttlMs))
    return true
  }
  async unlock(id: string) { this.kv.removeItem(`${this.prefix}lock.${id}`) }
}

let impl: OrderStore | null = null
export async function initStore(): Promise<OrderStore> { return impl ??= new LocalStore() }
function s(): OrderStore { if (!impl) throw new Error('initStore() was not called'); return impl }
export const store: OrderStore = {
  get kind() { return s().kind },
  get: id => s().get(id),
  all: () => s().all(),
  put: o => s().put(o),
  lock: (id, ttl) => s().lock(id, ttl),
  unlock: id => s().unlock(id),
}
