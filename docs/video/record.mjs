import { chromium } from 'playwright-core'
import { writeFileSync, readdirSync, renameSync } from 'node:fs'
const BASE = process.env.BASE
const W = 430, H = 932
const browser = await chromium.launch({
  executablePath: '/usr/bin/google-chrome', headless: true,
  args: ['--disable-features=PrivateNetworkAccessSendPreflights,PrivateNetworkAccessRespectPreflightResults,LocalNetworkAccessChecks,BlockInsecurePrivateNetworkRequests'],
})
const ctx = await browser.newContext({ viewport: { width: W, height: H }, locale: 'en-US', recordVideo: { dir: './raw', size: { width: W, height: H } } })
const page = await ctx.newPage()
const t0 = Date.now(); const marks = []
const mark = (k) => { marks.push({ k, t: (Date.now() - t0) / 1000 }); console.log(k, marks.at(-1).t) }
const pause = (ms) => page.waitForTimeout(ms)
page.on('dialog', async d => { console.log('dialog:', d.message().split('\n').join(' | ')); await pause(1500); await d.accept() })
page.on('console', m => { if (m.type() === 'error') console.log('console error:', m.text()) })
const slowType = async (loc, text) => { await loc.click(); await loc.fill(''); await loc.pressSequentially(text, { delay: 120 }) }
const waitStatus = async (re) => page.locator('.status b').filter({ hasText: re }).waitFor({ timeout: 120000 })

await page.goto(BASE); mark('open')
await page.getByRole('button', { name: 'Connect Nimiq Pay' }).waitFor({ timeout: 30000 }); mark('connect-visible')
await pause(2500)
await page.getByRole('button', { name: 'Connect Nimiq Pay' }).click()
await page.locator('.acct b').waitFor({ timeout: 30000 }); mark('connected')
await pause(3000)
// Cash out success
mark('cashout-form')
await slowType(page.getByLabel('FCFA'), '2000')
await pause(1500)
await slowType(page.locator('.phone input'), '670000000')
await pause(3000)
mark('cashout-confirm')
await page.locator('button.primary').click()
await page.locator('.status').waitFor({ timeout: 60000 }); mark('cashout-order')
await waitStatus(/^Paid$/); mark('cashout-paid')
await pause(5000)
await page.locator('button.primary').click(); await pause(1500)
// Cash out with failing number -> refund
mark('refund-form')
await slowType(page.getByLabel('FCFA'), '1000')
await slowType(page.locator('.phone input'), '690000001')
await pause(2500)
await page.locator('button.primary').click()
await page.locator('.status').waitFor({ timeout: 60000 }); mark('refund-order')
await waitStatus(/^Refunded$/); mark('refunded')
await pause(5000)
await page.locator('button.primary').click(); await pause(1500)
// Top up
await page.getByRole('button', { name: /Top up/i }).first().click(); mark('topup-form')
await pause(1500)
await slowType(page.getByLabel('FCFA'), '2000')
await slowType(page.locator('.phone input'), '650000000')
await pause(2500)
await page.locator('button.primary').click()
await page.locator('.status').waitFor({ timeout: 60000 }); mark('topup-order')
await waitStatus(/NIM delivered/); mark('delivered')
await pause(5000)
await page.locator('button.primary').click(); await pause(1500)
// History
await page.getByRole('button', { name: /History/i }).first().click(); mark('history')
await pause(5000)
// French
await page.locator('button.lang').click(); mark('french')
await pause(3000)
await page.locator('nav.tabs button').first().click()
await pause(5000); mark('end')
await ctx.close(); await browser.close()
const f = readdirSync('./raw').find(x => x.endsWith('.webm')); renameSync(`./raw/${f}`, './raw/session.webm')
writeFileSync('marks.json', JSON.stringify(marks, null, 1))
