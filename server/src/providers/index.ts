import { config } from '../config.js'
import { campay } from './campay.js'
import { fapshi } from './fapshi.js'
import { simulator } from './simulator.js'
import type { MobileMoneyProvider } from './types.js'

export function getProvider(): MobileMoneyProvider {
  switch (config.provider) {
    case 'fapshi': return fapshi
    case 'campay': return campay
    default: return simulator
  }
}
