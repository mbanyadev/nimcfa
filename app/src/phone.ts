export type Operator = 'mtn' | 'orange'
export function normalize(input: string): string | null {
  let d = input.replace(/\D/g, '')
  if (d.startsWith('00237')) d = d.slice(5)
  else if (d.startsWith('237') && d.length === 12) d = d.slice(3)
  return /^6\d{8}$/.test(d) ? d : null
}
export function operatorOf(phone: string | null): Operator | null {
  if (!phone) return null
  if (/^6(5[0-4]|7\d|8[0-4])\d{6}$/.test(phone)) return 'mtn'
  if (/^6(5[5-9]|9\d|8[5-9])\d{6}$/.test(phone)) return 'orange'
  return null
}
export const formatPhone = (p: string) => p.replace(/^(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5')
