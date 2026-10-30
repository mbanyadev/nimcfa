/** Cameroon mobile numbers: 9 digits starting with 6. Operator is derived from the prefix. */
export type Operator = 'mtn' | 'orange'

const MTN = /^6(5[0-4]|7\d|8[0-4])\d{6}$/
const ORANGE = /^6(5[5-9]|9\d|8[5-9])\d{6}$/

export function normalizeCmPhone(input: string): string | null {
  let d = input.replace(/[^\d]/g, '')
  if (d.startsWith('00237')) d = d.slice(5)
  else if (d.startsWith('237') && d.length === 12) d = d.slice(3)
  return /^6\d{8}$/.test(d) ? d : null
}

export function detectOperator(phone: string): Operator | null {
  if (MTN.test(phone)) return 'mtn'
  if (ORANGE.test(phone)) return 'orange'
  return null
}

export function maskPhone(phone: string): string {
  return `${phone.slice(0, 3)} ** ** ${phone.slice(7)}`
}
