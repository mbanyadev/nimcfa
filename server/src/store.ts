import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Order } from './types.ts'

/**
 * Order storage behind one small async interface, so the same engine runs on:
 *  - a normal server with a JSON file (STORE=file, the default on Node),
 *  - serverless hosts with a read-only or throwaway disk using Deno KV (STORE=kv, the default on Deno),
 *  - tests and quick demos in memory (STORE=memory).
 * `lock` gives one worker at a time the right to advance an order, so two instances never pay out twice.
 */
export interface OrderStore {
  readonly kind: string
  get(id: string): Promise<Order | undefined>
  all(): Promise<Order[]>
  put(o: Order): Promise<Order>
  lock(id: string, ttlMs: number): Promise<boolean>
  unlock(id: string): Promise<void>
}

class MemoryStore implements OrderStore {
  kind = 'memory'
  protected orders = new Map<string, Order>()
  private locks = new Map<string, number>()
  async get(id: string) { const o = this.orders.get(id); return o && structuredClone(o) }
  async all() { return [...this.orders.values()].map(o => structuredClone(o)) }
  async put(o: Order) {
    o.updatedAt = Date.now()
    this.orders.set(o.id, structuredClone(o))
    this.flush()
    return o
  }
  async lock(id: string, ttlMs: number) {
    const until = this.locks.get(id)
    if (until && until > Date.now()) return false
    this.locks.set(id, Date.now() + ttlMs)
    return true
  }
  async unlock(id: string) { this.locks.delete(id) }
  protected flush() {}
}

class FileStore extends MemoryStore {
  kind = 'file'
  constructor(private file: string) {
    super()
    if (existsSync(file)) {
      const rows = JSON.parse(readFileSync(file, 'utf8')) as Order[]
      for (const o of rows) this.orders.set(o.id, o)
    }
  }
  protected flush() {
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify([...this.orders.values()], null, 1))
    renameSync(tmp, this.file)
  }
}

// Minimal structural type for Deno KV so this file also typechecks under Node.
interface Kv {
  get<T>(key: unknown[]): Promise<{ value: T | null, versionstamp: string | null }>
  set(key: unknown[], value: unknown, opts?: { expireIn?: number }): Promise<unknown>
  delete(key: unknown[]): Promise<void>
  list<T>(sel: { prefix: unknown[] }): AsyncIterable<{ value: T }>
  atomic(): { check(...c: { key: unknown[], versionstamp: string | null }[]): any, set(k: unknown[], v: unknown, o?: { expireIn?: number }): any, commit(): Promise<{ ok: boolean }> }
}

class KvStore implements OrderStore {
  kind = 'kv'
  constructor(private kv: Kv) {}
  async get(id: string) { return (await this.kv.get<Order>(['orders', id])).value ?? undefined }
  async all() {
    const out: Order[] = []
    for await (const e of this.kv.list<Order>({ prefix: ['orders'] })) out.push(e.value)
    return out
  }
  async put(o: Order) {
    o.updatedAt = Date.now()
    await this.kv.set(['orders', o.id], o)
    return o
  }
  async lock(id: string, ttlMs: number) {
    const key = ['locks', id]
    const cur = await this.kv.get<number>(key)
    if (cur.value && cur.value > Date.now()) return false
    const r = await this.kv.atomic().check({ key, versionstamp: cur.versionstamp })
      .set(key, Date.now() + ttlMs, { expireIn: ttlMs }).commit()
    return r.ok
  }
  async unlock(id: string) { await this.kv.delete(['locks', id]) }
}

let impl: OrderStore | null = null

/** Pick the backend from STORE (file | kv | memory). Call once at startup. */
export async function initStore(): Promise<OrderStore> {
  if (impl) return impl
  const D = (globalThis as { Deno?: { openKv?: (path?: string) => Promise<Kv> } }).Deno
  const kind = process.env.STORE ?? (D?.openKv ? 'kv' : 'file')
  if (kind === 'kv') {
    if (!D?.openKv) throw new Error('STORE=kv needs the Deno runtime (Deno.openKv)')
    impl = new KvStore(await D.openKv(process.env.KV_PATH || undefined))
  }
  else if (kind === 'memory') impl = new MemoryStore()
  else impl = new FileStore(process.env.DATA_FILE ?? './data/orders.json')
  console.log(`Order store: ${impl.kind}`)
  return impl
}

function s(): OrderStore {
  if (!impl) throw new Error('initStore() was not called')
  return impl
}

export const store: OrderStore = {
  get kind() { return s().kind },
  get: id => s().get(id),
  all: () => s().all(),
  put: o => s().put(o),
  lock: (id, ttl) => s().lock(id, ttl),
  unlock: id => s().unlock(id),
}
