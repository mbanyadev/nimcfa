/**
 * @nimiq/core for the browser demo engine. Loads only the main WASM module (Address, KeyPair,
 * TransactionBuilder, ...), not the full light client, and initialises it once. The build swaps this in for
 * `@nimiq/core` inside server/src when bundling for the browser.
 */
// @ts-expect-error the web build's main-wasm module is not listed in the package exports, so it has no typings here
import init, * as wasm from '../node_modules/@nimiq/core/web/main-wasm/index.js'

await (init as () => Promise<unknown>)()
const N = wasm as typeof import('@nimiq/core')
export const { Address, KeyPair, PrivateKey, TransactionBuilder } = N
