import type { Operator } from '../phone.ts'

export type ProviderStatus = 'pending' | 'successful' | 'failed'

export interface MobileMoneyProvider {
  readonly name: string
  readonly sandbox: boolean
  /** Send XAF to a mobile money wallet. Returns the provider reference. */
  payout(p: { amount: number, phone: string, operator: Operator, externalId: string, message: string }): Promise<{ ref: string, status: ProviderStatus }>
  /** Ask the payer's phone for a mobile money payment (USSD push). */
  collect(p: { amount: number, phone: string, operator: Operator, externalId: string, message: string }): Promise<{ ref: string }>
  status(ref: string, kind: 'payout' | 'collect'): Promise<ProviderStatus>
}
