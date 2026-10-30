import { test } from 'node:test'
import assert from 'node:assert/strict'
process.env.FIXED_XAF_PER_NIM = '0.2'
process.env.DATA_FILE = '/tmp/nimcfa-test-orders.json'
const { detectOperator, normalizeCmPhone } = await import('../src/phone.js')
const { quoteOfframpFromXaf, quoteOnramp } = await import('../src/pricing.js')
const { checkDeposit } = await import('../src/orders.js')

test('phone numbers', () => {
  assert.equal(normalizeCmPhone('+237 6 70 00 00 00'), '670000000')
  assert.equal(normalizeCmPhone('00237690000000'), '690000000')
  assert.equal(normalizeCmPhone('22200000'), null)
  assert.equal(detectOperator('670000000'), 'mtn')
  assert.equal(detectOperator('650000000'), 'mtn')
  assert.equal(detectOperator('656000000'), 'orange')
  assert.equal(detectOperator('690000000'), 'orange')
})

test('quotes include the fee', async () => {
  const off = await quoteOfframpFromXaf(1000) // 1.5% fee at 0.2 XAF/NIM
  assert.equal(off.xaf, 1000)
  assert.ok(off.nimLuna * 0.2 / 1e5 * (1 - 0.015) >= 1000)
  const on = await quoteOnramp(1000) // 2% fee
  assert.equal(on.nimLuna, Math.floor(980 / 0.2 * 1e5))
})

test('deposit checks', () => {
  const o = { depositAddress: 'NQ92 X', memo: 'NIMCFA ABC', userAddress: 'NQ11 U', nimLuna: 500 } as any
  const tx = { networkId: 5, to: 'NQ92 X', from: 'NQ11 U', value: 500, recipientData: Buffer.from('NIMCFA ABC').toString('hex'), executionResult: true } as any
  assert.equal(checkDeposit(o, tx), null)
  assert.match(checkDeposit(o, { ...tx, value: 499 })!, /too low/)
  assert.match(checkDeposit(o, { ...tx, recipientData: '' })!, /memo/)
  assert.match(checkDeposit(o, { ...tx, from: 'NQ22 Z' })!, /different wallet/)
})
