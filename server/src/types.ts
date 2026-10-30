import type { Operator } from './phone.ts'

export type OfframpStatus =
  | 'awaiting_deposit' | 'deposit_seen' | 'paying_out' | 'paid' | 'payout_failed' | 'refunding' | 'refunded' | 'expired'
export type OnrampStatus =
  | 'awaiting_payment' | 'paid_in' | 'sending_nim' | 'delivered' | 'payment_failed' | 'expired'

export interface TimelineEvent { at: number, label: string, ref?: string }

export interface BaseOrder {
  id: string
  memo: string
  createdAt: number
  updatedAt: number
  expiresAt: number
  network: 'testnet' | 'mainnet'
  sandbox: boolean
  phone: string
  operator: Operator
  xaf: number
  feeXaf: number
  nimLuna: number
  xafPerNim: number
  userAddress: string
  timeline: TimelineEvent[]
  error?: string
}

export interface OfframpOrder extends BaseOrder {
  kind: 'offramp'
  status: OfframpStatus
  depositAddress: string
  depositTx?: string
  payoutRef?: string
  refundTx?: string
}

export interface OnrampOrder extends BaseOrder {
  kind: 'onramp'
  status: OnrampStatus
  collectRef?: string
  deliveryTx?: string
}

export type Order = OfframpOrder | OnrampOrder
