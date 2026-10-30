import 'dotenv/config'

export type NimNetwork = 'testnet' | 'mainnet'
export type ProviderName = 'simulator' | 'fapshi' | 'campay'

function num(name: string, fallback: number): number {
  const v = process.env[name]
  if (v === undefined || v === '') return fallback
  const n = Number(v)
  if (!Number.isFinite(n)) throw new Error(`${name} must be a number`)
  return n
}

const network = (process.env.NIM_NETWORK ?? 'testnet') as NimNetwork
if (network !== 'testnet' && network !== 'mainnet') throw new Error('NIM_NETWORK must be testnet or mainnet')

export const config = {
  port: num('PORT', 8787),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '*').split(',').map(s => s.trim()),
  dataFile: process.env.DATA_FILE ?? './data/orders.json',

  network,
  networkId: network === 'mainnet' ? 24 : 5,
  rpcUrl: process.env.NIM_RPC_URL
    ?? (network === 'mainnet' ? 'https://rpc.nimiqwatch.com' : 'https://rpc.testnet.nimiqwatch.com/'),
  explorer: network === 'mainnet' ? 'https://nimiq.watch/#' : 'https://test.nimiq.watch/#',
  /** Hex private key of the treasury / escrow wallet. Never commit it. */
  treasuryPrivateKey: process.env.TREASURY_PRIVATE_KEY ?? '',
  minConfirmations: num('MIN_CONFIRMATIONS', 2),

  provider: (process.env.PAYOUT_PROVIDER ?? 'simulator') as ProviderName,
  fapshi: {
    baseUrl: process.env.FAPSHI_BASE_URL ?? 'https://sandbox.fapshi.com',
    payoutUser: process.env.FAPSHI_PAYOUT_APIUSER ?? '',
    payoutKey: process.env.FAPSHI_PAYOUT_APIKEY ?? '',
    collectUser: process.env.FAPSHI_COLLECT_APIUSER ?? '',
    collectKey: process.env.FAPSHI_COLLECT_APIKEY ?? '',
  },
  campay: {
    baseUrl: process.env.CAMPAY_BASE_URL ?? 'https://demo.campay.net/api',
    token: process.env.CAMPAY_TOKEN ?? '',
  },

  /** Fees in basis points, applied to every quote. */
  offrampFeeBps: num('OFFRAMP_FEE_BPS', 150),
  onrampFeeBps: num('ONRAMP_FEE_BPS', 200),
  quoteTtlSeconds: num('QUOTE_TTL_SECONDS', 600),
  minXaf: num('MIN_XAF', 100),
  maxXaf: num('MAX_XAF', 500_000),
  /** Optional fixed price override (XAF per NIM) for offline demos and tests. */
  fixedXafPerNim: process.env.FIXED_XAF_PER_NIM ? Number(process.env.FIXED_XAF_PER_NIM) : undefined,
}

export const isSandbox = config.provider === 'simulator'
  || (config.provider === 'fapshi' && config.fapshi.baseUrl.includes('sandbox'))
  || (config.provider === 'campay' && config.campay.baseUrl.includes('demo'))
