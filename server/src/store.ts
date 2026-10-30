import { mkdirSync, readFileSync, renameSync, writeFileSync, existsSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from './config.js'
import type { Order } from './types.js'

/** Tiny durable JSON store. Good enough for a single-instance MVP; swap for Postgres/SQLite later. */
class Store {
  private orders = new Map<string, Order>()
  constructor(private file: string) {
    if (existsSync(file)) {
      const rows = JSON.parse(readFileSync(file, 'utf8')) as Order[]
      for (const o of rows) this.orders.set(o.id, o)
    }
  }
  get(id: string) { return this.orders.get(id) }
  all() { return [...this.orders.values()] }
  put(o: Order) {
    o.updatedAt = Date.now()
    this.orders.set(o.id, o)
    this.flush()
    return o
  }
  private flush() {
    mkdirSync(dirname(this.file), { recursive: true })
    const tmp = `${this.file}.tmp`
    writeFileSync(tmp, JSON.stringify(this.all(), null, 1))
    renameSync(tmp, this.file)
  }
}

export const store = new Store(config.dataFile)
