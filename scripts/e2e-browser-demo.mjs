// Headless click-through of the hosted demo (or any build): cash-out, refunded cash-out, top-up, history, FR.
// Usage: BASE=https://mbanyadev.github.io/nimcfa/ node scripts/e2e-browser-demo.mjs  (needs playwright-core + Chrome)
// SHOTS=dir also saves a 390x844 screenshot of every screen into dir.
import { chromium } from 'playwright-core'
const BASE = process.env.BASE
const SHOTS = process.env.SHOTS
const browser = await chromium.launch({ executablePath: process.env.CHROME ?? '/usr/bin/google-chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: Number(process.env.W ?? 390), height: Number(process.env.H ?? 844) }, deviceScaleFactor: SHOTS ? 2 : 1, locale: 'en-US' })
const page = await ctx.newPage()
const t0 = Date.now(); const log = (...a) => console.log(((Date.now() - t0) / 1000).toFixed(1) + 's', ...a)
page.on('dialog', d => { log('dialog:', d.message().split('\n').join(' | ')); d.accept() })
page.on('console', m => { if (['error', 'warning'].includes(m.type())) log('console', m.type(), m.text().slice(0, 200)) })
page.on('pageerror', e => { log('pageerror', e.message); process.exitCode = 1 })
const shot = async (name) => {
  if (!SHOTS) return
  await page.mouse.move(1, 1)
  await page.evaluate(() => document.activeElement?.blur())
  await page.waitForTimeout(350)
  // flag anything wider than the viewport (horizontal overflow)
  const over = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1 && getComputedStyle(e).position !== 'fixed' && !e.closest('.lattice, .hero-card, .burst')).map(e => e.className || e.tagName).slice(0, 5))
  if (over.length) log('OVERFLOW on', name, over)
  await page.screenshot({ path: `${SHOTS}/${name}.png` })
  log('shot', name)
}
const status = () => page.locator('[data-status]').getAttribute('data-status')
const waitStatus = (s, ms = 150000) => page.locator(`[data-status="${s}"]`).waitFor({ timeout: ms })

await page.goto(BASE)
const connectBtn = page.getByRole('button', { name: 'Connect Nimiq Pay' })
await page.locator('.waiting').waitFor({ timeout: 20000 }).then(() => shot('00-connecting')).catch(() => {})
await connectBtn.waitFor({ timeout: 120000 }); log('connect visible')
await shot('01-welcome')
await connectBtn.click()
await page.locator('.balance .num').filter({ hasText: /\d/ }).waitFor({ timeout: 60000 })
log('connected', (await page.locator('.balance').innerText()).replace(/\n/g, ' · '))
await page.waitForTimeout(1500)
await shot('02-home')

async function fill(kind, xaf, phone) {
  await page.getByRole('tab', { name: kind === 'onramp' ? 'Top up' : 'Cash out' }).click()
  await page.getByLabel('FCFA').fill(String(xaf))
  await page.locator('.phone input').fill(phone)
  await page.locator('.quote-nim').filter({ hasText: /\d/ }).first().waitFor({ timeout: 30000 })
  await page.waitForTimeout(500)
}
async function order(kind, xaf, phone, done, shots = {}) {
  await page.locator('.tile').filter({ hasText: kind === 'onramp' ? 'Top up' : 'Cash out' }).click()
  await fill(kind, xaf, phone)
  if (shots.form) await shot(shots.form)
  await page.locator('button.primary').click()
  if (kind === 'offramp') {
    await page.locator('.sheet').waitFor({ timeout: 30000 })
    if (shots.sheet) await shot(shots.sheet)
    await page.locator('.sheet').getByRole('button', { name: 'Approve' }).click()
  }
  await page.locator('[data-status]').waitFor({ timeout: 60000 })
  if (shots.live) await shot(shots.live)
  try { await waitStatus(done) } catch (e) { log('TIMEOUT at', await status()); throw e }
  if (shots.final) await shot(shots.final)
  log(kind, xaf, phone, '->', await status(), '·', (await page.locator('main').innerText()).replace(/\n+/g, ' · ').slice(0, 220))
  const details = page.getByRole('button', { name: 'Transaction details' })
  if (await details.count()) { await details.click(); log('  timeline:', (await page.locator('.timeline li').allInnerTexts()).map(s => s.replace(/\n/g, ' ')).join(' | ')) }
  if (shots.retry) { // "Try again" reopens the form for the same direction
    await page.getByRole('button', { name: 'Try again' }).click()
    await page.locator('.ramp').waitFor({ timeout: 10000 })
  }
  await page.getByRole('button', { name: done === 'paid' || done === 'delivered' ? 'Done' : 'Back to home' }).first().click()
  await page.locator('.home').waitFor({ timeout: 10000 })
  await page.waitForTimeout(800)
}
await order('offramp', 10000, '677123456', 'paid', { form: '03-cashout', sheet: '04-approve', live: '05-progress', final: '06-success' })
await order('offramp', 2000, '690000001', 'refunded', { final: '10-refunded', retry: true })
await order('onramp', 10000, '699887766', 'delivered', { form: '07-topup', live: '08-ussd', final: '09-delivered' })
await page.waitForTimeout(1500)
log('history:', (await page.locator('.history li').allInnerTexts()).map(s => s.replace(/\n/g, ' ')).join(' | '))
await shot('11-home-recent')
// French
await page.getByRole('button', { name: 'FR' }).click()
await shot('12-home-fr')
await page.locator('.tile').first().click()
await page.getByLabel('FCFA').fill('5000')
await page.locator('.phone input').fill('699887766')
await page.locator('.quote-nim').filter({ hasText: /\d/ }).first().waitFor({ timeout: 30000 })
await shot('13-cashout-fr')
log('balance', (await page.locator('header').innerText()).replace(/\n/g, ' '))
if (!SHOTS) await page.screenshot({ path: process.env.SHOT ?? 'e2e-demo.png' })
await browser.close()
log(process.exitCode ? 'E2E FAILED' : 'E2E OK')
