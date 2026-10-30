// Resolved by vite.config.ts to server/src/main.browser.ts (typechecked with the server).
declare module 'nimcfa-engine' {
  export interface BrowserEngine {
    fetch(path: string, init?: RequestInit): Promise<Response>
    walletKey: string
    walletAddress: string
    treasuryAddress: string
    fundWallet(): Promise<void>
  }
  export function startBrowserEngine(opts: {
    treasuryKey: string, walletKey?: string | null, workerIntervalMs?: number, log?: (msg: string) => void
  }): Promise<BrowserEngine>
}
