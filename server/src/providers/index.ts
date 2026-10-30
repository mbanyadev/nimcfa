import { config } from '../config.ts'
import { campay } from './campay.ts'
import { fapshi } from './fapshi.ts'
import { simulator } from './simulator.ts'
import type { MobileMoneyProvider } from './types.ts'

export function getProvider(): MobileMoneyProvider {
  switch (config.provider) {
    case 'fapshi': return fapshi
    case 'campay': return campay
    default: return simulator
  }
}
