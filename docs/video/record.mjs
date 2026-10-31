// Records the demo session from the live Pages build (headless Chrome, 430x932 phone viewport).
// Usage: BASE=https://mbanyadev.github.io/nimcfa/ node record.mjs  → raw/session.webm + marks.json, then python3 build.py
import { chromium } from 'playwright-core'
import { writeFileSync, readdirSync, renameSync, rmSync } from 'node:fs'
const BASE = process.env.BASE
const W = 430, H = 932
rmSync('./raw', { recursive: true, force: true })
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, locale: 'en-US', recordVideo: { dir: './raw', size: { width: W, height: H } } })
const page = await ctx.newPage()
const t0 = Date.now(); const marks = []
const mark = (k) => { marks.push({ k, t: (Date.now() - t0) / 1000 }); console.log(k, marks.at(-1).t) }
const pause = (ms) => page.waitForTimeout(ms)
page.on('console', m => { if (m.type() === 'error') console.log('console error:', m.text()) })
page.on('pageerror', e => console.log('pageerror', e.message))
const slowType = async (loc, text) => { await loc.click(); await loc.fill(''); await loc.pressSequentially(text, { delay: 110 }) }
const waitStatus = (s) => page.locator(`[data-status="${s}"]`).waitFor({ timeout: 150000 })
const quoteReady = () => page.locator('.quote-nim').filter({ hasText: /\d/ }).first().waitFor({ timeout: 30000 })
const home = async (name) => { await page.getByRole('button', { name }).first().click(); await page.locator('.home').waitFor({ timeout: 10000 }) }

await page.goto(BASE); mark('open')
const connect = page.getByRole('button', { name: 'Connect Nimiq Pay' })
await connect.waitFor({ timeout: 120000 }); mark('connect-visible')
await pause(3000)
await connect.click()
await page.locator('.balance .num').filter({ hasText: /\d/ }).waitFor({ timeout: 60000 }); mark('connected')
await pause(3500)
// 1 · Cash out → paid
await page.locator('.tile').filter({ hasText: 'Cash out' }).click(); mark('cashout-form')
await pause(1200)
await slowType(page.getByLabel('FCFA'), '10000')
await pause(800)
await slowType(page.locator('.phone input'), '677123456')
await quoteReady(); await pause(3000)
mark('cashout-confirm')
await page.locator('button.primary').click()
await page.locator('.sheet').waitFor({ timeout: 30000 }); await pause(2500)
await page.locator('.sheet').getByRole('button', { name: 'Approve' }).click()
await page.locator('[data-status]').waitFor({ timeout: 60000 }); mark('cashout-order')
await waitStatus('paid'); mark('cashout-paid')
await pause(5000)
await home('Done'); await pause(1200)
// 2 · Cash out to a failing number → automatic refund
await page.locator('.tile').filter({ hasText: 'Cash out' }).click(); mark('refund-form')
await slowType(page.getByLabel('FCFA'), '2000')
await slowType(page.locator('.phone input'), '690000001')
await quoteReady(); await pause(2000)
await page.locator('button.primary').click()
await page.locator('.sheet').waitFor({ timeout: 30000 }); await pause(1200)
await page.locator('.sheet').getByRole('button', { name: 'Approve' }).click()
await page.locator('[data-status]').waitFor({ timeout: 60000 }); mark('refund-order')
await waitStatus('refunded'); mark('refunded')
await pause(5500)
await home('Back to home'); await pause(1200)
// 3 · Top up → USSD → delivered
await page.locator('.tile').filter({ hasText: 'Top up' }).click(); mark('topup-form')
await pause(1000)
await slowType(page.getByLabel('FCFA'), '10000')
await slowType(page.locator('.phone input'), '699887766')
await quoteReady(); await pause(2500)
await page.locator('button.primary').click()
await page.locator('[data-status]').waitFor({ timeout: 60000 }); mark('topup-order')
await waitStatus('delivered'); mark('delivered')
await pause(5000)
await home('Done'); mark('history')
await pause(1500)
await page.mouse.move(W / 2, H / 2); await page.mouse.wheel(0, 400); await pause(3500)
await page.mouse.wheel(0, -400); await pause(1200)
// French
await page.getByRole('button', { name: 'FR' }).click(); mark('french')
await pause(3500)
await page.locator('.tile').first().click(); await pause(1000)
await slowType(page.getByLabel('FCFA'), '5000')
await slowType(page.locator('.phone input'), '699887766')
await quoteReady(); await pause(4000); mark('end')
await ctx.close(); await browser.close()
const f = readdirSync('./raw').find(x => x.endsWith('.webm')); renameSync(`./raw/${f}`, './raw/session.webm')
writeFileSync('marks.json', JSON.stringify(marks, null, 1))
