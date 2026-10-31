import { useCallback, useEffect, useRef, useState } from 'react'
import { api, DEMO, type Health, type Order, type Quote } from './api'
import { dicts, fmtInt, fmtNim, fmtRate, fmtXaf, type Dict, type Lang } from './i18n'
import { Hex, Icon, MomoArt } from './icons'
import { normalize, operatorOf } from './phone'
import { connectWallet, hostLanguage, setPreviewConfirm, UserCancelled, type Wallet } from './wallet'

type Kind = 'offramp' | 'onramp'
type View = { name: 'home' } | { name: 'ramp', kind: Kind }
type PendingTx = { tx: { recipient: string, value: number, data: string }, resolve: (ok: boolean) => void }
const FINAL = new Set(['paid', 'refunded', 'expired', 'payout_failed', 'delivered', 'payment_failed'])
const opName = (op: string) => op === 'mtn' ? 'MTN MoMo' : 'Orange Money'

/** Re-render every second (rate-lock countdowns). */
function useNow(on = true) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!on) return
    const h = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(h)
  }, [on])
  return now
}
/** Types as "677 12 34 56"; a pasted +237 / 00237 prefix is kept as typed so normalize() can strip it. */
const groupPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14)
  return d.length > 9 ? d : d.replace(/^(\d{3})(\d{0,2})(\d{0,2})(\d{0,2}).*/, (_, a, b, c, e) => [a, b, c, e].filter(Boolean).join(' '))
}
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export default function App() {
  const [lang, setLang] = useState<Lang>(hostLanguage())
  const t = dicts[lang]
  const [wallet, setWallet] = useState<Wallet | null | undefined>(undefined)
  const [address, setAddress] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [view, setView] = useState<View>({ name: 'home' })
  const [active, setActive] = useState<Order | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pending, setPending] = useState<PendingTx | null>(null)
  const [historyKey, setHistoryKey] = useState(0)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])
  useEffect(() => {
    setPreviewConfirm(tx => new Promise(resolve => setPending({ tx, resolve })))
    api.health().then(setHealth).catch(e => setErr(e.message))
    connectWallet().then(setWallet)
  }, [])

  const refreshBalance = useCallback(async () => {
    if (wallet && address) setBalance(await wallet.getBalance(address))
  }, [wallet, address])

  async function connect() {
    if (!wallet) return
    setErr(null)
    try {
      const [a] = await wallet.listAccounts()
      setAddress(a ?? null)
      if (a) setBalance(await wallet.getBalance(a))
    }
    catch (e) { setErr((e as Error).message) }
  }

  const goHome = () => { setActive(null); setView({ name: 'home' }); setHistoryKey(k => k + 1); refreshBalance() }
  const networkMismatch = wallet && health && wallet.network !== health.network
  const testnet = (health?.network ?? wallet?.network) === 'testnet'
  const connected = wallet && address
  const showClose = connected && (active || view.name !== 'home')

  return (
    <div className="app">
      <header className="top">
        <Hex className="logo" />
        <span className="brand">NimCFA</span>
        {testnet && <span className="badge"><i />{t.testnetDemo}</span>}
        <span className="grow" />
        <div className="seg-lang" role="group" aria-label="Language">
          {(['en', 'fr'] as Lang[]).map(l => (
            <button key={l} className={lang === l ? 'on' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
          ))}
        </div>
        {showClose && <button className="icon-btn" aria-label={t.backHome} onClick={goHome}><Icon name="close" size={16} /></button>}
      </header>

      {networkMismatch && <div className="banner warn">Nimiq Pay is on {wallet!.network}, this service runs on {health!.network}.</div>}

      {!connected && <Welcome t={t} wallet={wallet} onConnect={connect} sandbox={!!health?.sandbox} />}

      {connected && !active && view.name === 'home' && (
        <Home t={t} health={health} balance={balance} address={address} historyKey={historyKey}
          onRamp={kind => setView({ name: 'ramp', kind })} onOpen={setActive} />
      )}
      {connected && !active && view.name === 'ramp' && health && (
        <RampForm key={view.kind} kind={view.kind} t={t} health={health} wallet={wallet} address={address}
          balance={balance} onKind={kind => setView({ name: 'ramp', kind })}
          onStarted={o => { setActive(o); refreshBalance() }} />
      )}
      {connected && active && (
        <OrderView key={active.id} t={t} initial={active} onFinal={refreshBalance} onHome={goHome}
          onRetry={kind => { setActive(null); setView({ name: 'ramp', kind }) }} />
      )}

      {err && <div className="banner warn">{err}</div>}
      {pending && <PreviewSheet t={t} p={pending} onDone={() => setPending(null)} />}
    </div>
  )
}

function Welcome({ t, wallet, onConnect, sandbox }: { t: Dict, wallet: Wallet | null | undefined, onConnect: () => void, sandbox: boolean }) {
  return (
    <main className="screen">
      <section className="hero-card welcome">
        <div className="lattice tr" />
        <MomoArt size={148} bg="#2b3060" />
        <h2>{t.welcomeTitle}</h2>
        <p>{t.why}</p>
      </section>
      <ul className="perks">
        <li><span className="perk-ic"><Icon name="clock" size={18} /></span>{t.perkRate}</li>
        <li><span className="perk-ic"><Icon name="shield" size={18} /></span>{t.perkRefund}</li>
        <li><span className="perk-ic ops"><i className="mtn" /><i className="orange" /></span>{t.perkOps}</li>
      </ul>
      <div className="grow" />
      {(DEMO || sandbox) && <div className="info"><Icon name="shield" /><span>{DEMO ? t.demo : ''} {sandbox ? t.sandbox : ''}</span></div>}
      {wallet === undefined && <div className="waiting"><span className="spin" />{t.connecting}</div>}
      {wallet === null && <div className="info warn"><Icon name="phone" /><span>{t.notInPay}</span></div>}
      {wallet && <button className="btn gold" onClick={onConnect}>{t.connect}</button>}
    </main>
  )
}

function Home({ t, health, balance, address, historyKey, onRamp, onOpen }: {
  t: Dict, health: Health | null, balance: number | null, address: string, historyKey: number,
  onRamp: (k: Kind) => void, onOpen: (o: Order) => void
}) {
  const rate = health?.xafPerNim ?? null
  return (
    <main className="screen home">
      <section className="hero-card balance">
        <div className="lattice tr" />
        <span className="label">{t.walletBalance}</span>
        <div className="big"><span className="num">{balance === null ? '–' : fmtNim(balance, t.locale, balance >= 1e8 ? 0 : 2)}</span><span className="unit">NIM</span></div>
        {balance !== null && rate && <span className="sub">≈ {fmtXaf(balance / 1e5 * rate, t.locale)}</span>}
        <span className="addr" title={address}>{address.slice(0, 9)}…{address.slice(-4)}</span>
        {rate && <span className="pill-glass">{fmtRate(rate, t.locale)}</span>}
      </section>
      <div className="tiles">
        <button className="tile gold" onClick={() => onRamp('offramp')}>
          <span className="tile-ic"><Icon name="out" /></span>
          <span className="tile-tx"><b>{t.cashOut}</b><small>{t.cashOutSub}</small></span>
        </button>
        <button className="tile" onClick={() => onRamp('onramp')}>
          <span className="tile-ic"><Icon name="in" /></span>
          <span className="tile-tx"><b>{t.topUp}</b><small>{t.topUpSub}</small></span>
        </button>
      </div>
      <section className="promo">
        <div><b>{t.promoTitle}</b><span>{t.promoBody}</span></div>
        <MomoArt size={104} />
      </section>
      <History t={t} address={address} onOpen={onOpen} refresh={historyKey} />
      {health?.sandbox && <p className="foot">{t.sandbox}</p>}
    </main>
  )
}

function History({ t, address, onOpen, refresh }: { t: Dict, address: string, onOpen: (o: Order) => void, refresh: number }) {
  const [list, setList] = useState<Order[] | null>(null)
  const [all, setAll] = useState(false)
  useEffect(() => { api.history(address).then(setList).catch(() => setList([])) }, [address, refresh])
  const when = (ms: number) => {
    const d = new Date(ms), now = new Date()
    const hm = d.toLocaleTimeString(t.locale, { hour: '2-digit', minute: '2-digit' })
    const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
    const diff = (day(now) - day(d)) / 864e5
    if (diff === 0) return `${t.today}, ${hm}`
    if (diff === 1) return `${t.yesterday}, ${hm}`
    return d.toLocaleDateString(t.locale, { day: 'numeric', month: 'short' }) + `, ${hm}`
  }
  const shown = list && (all ? list : list.slice(0, 3))
  return (
    <section className="recent">
      <div className="recent-h"><span>{t.recent}</span>{list && list.length > 3 && <button onClick={() => setAll(!all)}>{all ? t.showLess : t.seeAll}</button>}</div>
      {!list && <div className="row muted"><span className="spin sm" /></div>}
      {list && !list.length && <div className="row empty">{t.noHistory}</div>}
      <ul className="history">
        {shown?.map(o => {
          const bad = ['refunded', 'refunding', 'payout_failed', 'expired', 'payment_failed'].includes(o.status)
          const live = !FINAL.has(o.status) && o.status !== 'refunding'
          return (
            <li key={o.id}>
              <button className="row" onClick={() => onOpen(o)}>
                <span className={`op-dot ${o.operator}`}>{o.operator === 'mtn' ? 'MTN' : 'OM'}</span>
                <span className="row-tx"><b>{o.kind === 'offramp' ? t.cashOut : t.topUp}</b>
                  <small>{when(o.createdAt)}{(bad || live) && <> · <em className={bad ? 'bad' : 'live'}>{t.status[o.status] ?? o.status}</em></>}</small></span>
                <span className={`row-amt ${o.kind === 'onramp' && o.status === 'delivered' ? 'pos' : ''} ${bad ? 'strike' : ''}`}>
                  {o.kind === 'offramp' ? fmtXaf(o.xaf, t.locale) : `+${fmtNim(o.nimLuna, t.locale)} NIM`}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function RampForm({ kind, t, health, wallet, address, balance, onStarted, onKind }: {
  kind: Kind, t: Dict, health: Health, wallet: Wallet, address: string,
  balance: number | null, onStarted: (o: Order) => void, onKind: (k: Kind) => void
}) {
  const [xafText, setXafText] = useState(kind === 'offramp' ? '2000' : '5000')
  const [phoneText, setPhoneText] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteRound, setQuoteRound] = useState(0)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string, bad?: boolean } | null>(null)
  const xaf = Number(xafText.replace(/\D/g, '')) || 0
  const phone = normalize(phoneText)
  const op = operatorOf(phone)
  const { minXaf, maxXaf } = health.limits
  const amountOk = xaf >= minXaf && xaf <= maxXaf
  const now = useNow(!!quote)
  const left = quote ? quote.expiresAt - now : 0

  useEffect(() => {
    setQuote(null)
    if (!amountOk) return
    const h = setTimeout(() => { api.quote(kind, xaf).then(setQuote).catch(e => setMsg({ text: e.message, bad: true })) }, 300)
    return () => clearTimeout(h)
  }, [kind, xaf, amountOk, quoteRound])
  useEffect(() => { if (quote && left <= 0 && !busy) setQuoteRound(r => r + 1) }, [quote, left, busy])

  const insufficient = kind === 'offramp' && quote && balance !== null && balance < quote.nimLuna
  const digits = phoneText.replace(/\D/g, '')
  const feePct = quote ? ((quote.feeXaf / (kind === 'offramp' ? quote.xaf + quote.feeXaf : quote.xaf)) * 100).toFixed(1).replace(/\.0$/, '') : ''

  async function submit() {
    if (!phone || !op || !amountOk) return
    setBusy(true); setMsg(null)
    try {
      if (kind === 'offramp') {
        const order = await api.offramp({ xaf, phone, userAddress: address })
        setMsg({ text: t.approveInPay })
        let hash: string
        try { hash = await wallet.send({ recipient: order.depositAddress!, value: order.nimLuna, data: order.memo }) }
        catch (e) { if (e instanceof UserCancelled) { setMsg({ text: t.cancelled }); return } throw e }
        onStarted(await api.reportDeposit(order.id, hash))
      }
      else {
        onStarted(await api.onramp({ xaf, phone, userAddress: address }))
      }
    }
    catch (e) { setMsg({ text: (e as Error).message, bad: true }) }
    finally { setBusy(false) }
  }

  const opBadge = op
    ? <span className={`op-badge ${op}`}><i />{opName(op)}</span>
    : digits.length >= 2 ? <span className="op-badge none">{t.detecting}</span> : null

  return (
    <main className="screen ramp">
      <div className="seg" role="tablist">
        {(['offramp', 'onramp'] as Kind[]).map(k => (
          <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'on' : ''} onClick={() => onKind(k)}>
            {k === 'offramp' ? t.cashOut : t.topUp}
          </button>
        ))}
      </div>

      <section className="card amount-card">
        <span className="label">{kind === 'offramp' ? t.receive : t.youPay}</span>
        <div className="amount">
          <input inputMode="numeric" aria-label="FCFA" value={xaf ? fmtInt(xaf, t.locale) : ''}
            onChange={e => setXafText(e.target.value.replace(/\D/g, '').slice(0, 7))} placeholder="0" />
          <span className="unit">FCFA</span>
        </div>
        {!amountOk && xaf > 0 && <small className="bad">{t.amountRange(fmtXaf(minXaf, t.locale), fmtXaf(maxXaf, t.locale))}</small>}
        {kind === 'offramp'
          ? (
              <div className="chips">
                {[5000, 10000, 25000].map(v => <button key={v} className={xaf === v ? 'on' : ''} onClick={() => setXafText(String(v))}>{fmtInt(v, t.locale)}</button>)}
              </div>
            )
          : (
              <>
                <div className="get">
                  <span>{t.youGet}</span>
                  <b className="quote-nim">{quote ? fmtNim(quote.nimLuna, t.locale) : '–'} <small>NIM</small></b>
                </div>
                <small className="muted">{quote ? t.feeIncluded(feePct, fmtXaf(quote.feeXaf, t.locale), fmtRate(quote.xafPerNim, t.locale)) : '\u00a0'}</small>
              </>
            )}
      </section>

      <div className="field">
        <span className="label">{kind === 'offramp' ? t.phone : t.payFrom}</span>
        <div className={`phone ${digits.length >= 9 && !op ? 'invalid' : ''}`}>
          <span className="cc">+237</span>
          <input inputMode="tel" placeholder="6XX XX XX XX" aria-label={t.phone} value={phoneText} onChange={e => setPhoneText(groupPhone(e.target.value))} />
          {opBadge}
        </div>
        {digits.length >= 9 && !op ? <small className="bad">{t.invalidPhone}</small> : !digits.length && <small className="muted">{t.phoneHint}</small>}
      </div>

      {kind === 'offramp' && (
        <section className="card summary">
          <div><span>{quote ? t.feePct(feePct) : t.fee}</span><b>{quote ? fmtXaf(quote.feeXaf, t.locale) : '–'}</b></div>
          <div className="base"><span>{t.youSend}</span><b className="quote-nim">{quote ? fmtNim(quote.nimLuna, t.locale) : '–'} <small>NIM</small></b></div>
          <div className="sm"><span>{t.rate}</span><span>{quote ? fmtRate(quote.xafPerNim, t.locale) : '–'}</span></div>
        </section>
      )}

      {kind === 'onramp' ? <div className="art-slot"><MomoArt size={190} bg="#FCF1CF" /></div> : <div className="grow" />}

      {insufficient && <div className="note bad">{t.notEnough}</div>}
      {msg && <div className={`note ${msg.bad ? 'bad' : ''}`}>{msg.text}</div>}
      {quote && left > 0 && <div className="lock"><Icon name="clock" size={16} />{t.lockedFor} {clock(left)}</div>}
      <button className="btn gold primary" disabled={busy || !quote || !op || !!insufficient} onClick={submit}>
        {busy ? <span className="spin dark" /> : kind === 'offramp' ? (quote ? t.confirmSend(fmtNim(quote.nimLuna, t.locale)) : t.cashOut) : t.pay}
      </button>
    </main>
  )
}

function OrderView({ t, initial, onFinal, onHome, onRetry }: {
  t: Dict, initial: Order, onFinal: () => void, onHome: () => void, onRetry: (k: Kind) => void
}) {
  const [o, setO] = useState(initial)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    let stop = false
    const poll = async () => {
      try {
        const n = await api.order(o.id)
        if (stop) return
        setO(n)
        if (FINAL.has(n.status)) { onFinal(); return }
      }
      catch { /* keep polling */ }
      if (!stop) timer.current = window.setTimeout(poll, 2500)
    }
    poll()
    return () => { stop = true; clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.id])

  const s = o.status
  let body: React.ReactNode
  if (o.kind === 'offramp') {
    if (s === 'paid') body = <Success t={t} o={o} onHome={onHome} />
    else if (['refunding', 'refunded', 'payout_failed', 'expired'].includes(s)) body = <Problem t={t} o={o} onHome={onHome} onRetry={onRetry} />
    else body = <Progress t={t} o={o} onHome={onHome} />
  }
  else {
    if (s === 'awaiting_payment') body = <Ussd t={t} o={o} onHome={onHome} />
    else if (s === 'delivered') body = <Delivered t={t} o={o} onHome={onHome} />
    else if (['payment_failed', 'expired'].includes(s)) body = <Problem t={t} o={o} onHome={onHome} onRetry={onRetry} />
    else body = <Progress t={t} o={o} onHome={onHome} />
  }
  return <div className="order-wrap" data-status={s} data-order={o.id}>{body}</div>
}

const txLink = (o: Order, h?: string) => h && /^[0-9a-f]{64}$/.test(h) ? `${o.explorer}${h}` : undefined
const hm = (ms: number, locale: string) => new Date(ms).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
const eventAt = (o: Order, ref?: string) => o.timeline.find(e => ref && e.ref === ref)?.at

function Details({ t, o }: { t: Dict, o: Order }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="details">
      <button className="link" aria-expanded={open} onClick={() => setOpen(!open)}>{open ? t.hideDetails : t.details}</button>
      {open && (
        <ol className="timeline">
          {o.timeline.map((e, i) => (
            <li key={i}>
              <span>{e.label}</span>
              {txLink(o, e.ref) ? <a href={txLink(o, e.ref)} target="_blank" rel="noreferrer">tx ↗</a> : e.ref ? <code>{e.ref}</code> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

type StepState = 'done' | 'active' | 'todo'
function Step({ state, title, sub, last, next }: { state: StepState, title: string, sub: React.ReactNode, last?: boolean, next?: StepState }) {
  return (
    <li className={`step ${state}`}>
      <div className="rail">
        <span className="dot">{state === 'done' ? <Icon name="check" size={18} /> : null}</span>
        {!last && <span className={`bar ${state === 'done' && next === 'done' ? 'done' : state === 'done' ? 'half' : ''}`} />}
      </div>
      <div className="step-tx"><b>{title}</b><small>{sub}</small></div>
    </li>
  )
}

function Progress({ t, o, onHome }: { t: Dict, o: Order, onHome: () => void }) {
  const off = o.kind === 'offramp'
  const rate = fmtRate(o.xafPerNim, t.locale)
  const steps: { state: StepState, title: string, sub: React.ReactNode }[] = off
    ? (() => {
        const sent = o.status !== 'awaiting_deposit'
        const link = txLink(o, o.depositTx)
        const at = eventAt(o, o.depositTx)
        return [
          { state: 'done', title: t.stepQuote, sub: `${hm(o.createdAt, t.locale)} · ${rate}` },
          sent
            ? { state: 'done', title: t.stepNimSent, sub: <>{at ? `${hm(at, t.locale)} · ` : ''}{link ? <a href={link} target="_blank" rel="noreferrer">{t.viewTx}</a> : t.status[o.status]}</> }
            : { state: 'active', title: t.stepWaitNim, sub: t.approveFirst },
          { state: sent ? 'active' : 'todo', title: o.status === 'paying_out' ? t.stepPaying : t.stepPaid, sub: t.usually },
        ]
      })()
    : (() => {
        const delivering = o.status === 'sending_nim'
        return [
          { state: 'done', title: t.stepQuote, sub: `${hm(o.createdAt, t.locale)} · ${rate}` },
          { state: 'done', title: t.stepPaymentIn, sub: `${fmtXaf(o.xaf, t.locale)} · ${opName(o.operator)}` },
          { state: 'active', title: delivering ? t.stepSendingNim : t.stepDelivered, sub: t.usually },
        ]
      })()
  return (
    <main className="screen progress">
      <div className="headline">
        <span className="label">{off ? t.sendingTo(opName(o.operator), o.phone) : t.receivingFrom(opName(o.operator), o.phone)}</span>
        <div className="big">
          <span className="num">{off ? fmtInt(o.xaf, t.locale) : fmtNim(o.nimLuna, t.locale)}</span>
          <span className="unit">{off ? 'FCFA' : 'NIM'}</span>
        </div>
        <span className="sub">{off ? t.nimFee(fmtNim(o.nimLuna, t.locale), fmtXaf(o.feeXaf, t.locale)) : `${fmtXaf(o.xaf, t.locale)} · ${t.fee.toLowerCase()} ${fmtXaf(o.feeXaf, t.locale)}`}</span>
      </div>
      <ol className="card steps">
        {steps.map((st, i) => <Step key={i} {...st} last={i === steps.length - 1} next={steps[i + 1]?.state} />)}
      </ol>
      {o.error && <div className="note">{o.error}</div>}
      <div className="grow" />
      {off && <div className="info"><Icon name="shield" /><span>{t.refundPromise}</span></div>}
      <button className="btn text" onClick={onHome}>{t.backHome}</button>
    </main>
  )
}

function Confetti() {
  return (
    <>
      <span className="cf star" style={{ left: 44, top: 46, width: 18, height: 18 }} />
      <span className="cf" style={{ right: 52, top: 30, width: 14, height: 14, borderRadius: '50%', background: '#007A5E' }} />
      <span className="cf" style={{ right: 30, top: 150, width: 22, height: 8, borderRadius: 999, background: '#CE1126', transform: 'rotate(-30deg)' }} />
      <span className="cf" style={{ left: 30, bottom: 60, width: 20, height: 8, borderRadius: 999, background: '#007A5E', transform: 'rotate(25deg)' }} />
      <span className="cf star" style={{ right: 70, bottom: 30, width: 20, height: 20 }} />
      <span className="cf" style={{ left: 84, bottom: 24, width: 10, height: 10, borderRadius: '50%', background: '#1F2348' }} />
      <span className="cf" style={{ left: 96, top: 14, width: 9, height: 9, borderRadius: '50%', background: '#CE1126' }} />
    </>
  )
}

function Success({ t, o, onHome }: { t: Dict, o: Order, onHome: () => void }) {
  const [copied, setCopied] = useState(false)
  const amt = fmtXaf(o.xaf, t.locale)
  async function share() {
    const text = `NimCFA · ${t.paidBody(amt, opName(o.operator), o.phone)} ${fmtNim(o.nimLuna, t.locale)} NIM · #${o.id}`
    try {
      if (navigator.share) { await navigator.share({ title: 'NimCFA', text }); return }
      await navigator.clipboard.writeText(text); setCopied(true)
    }
    catch { /* user closed the share sheet */ }
  }
  return (
    <main className="screen success">
      <div className="burst">
        <div className="lattice ring" />
        <div className="medal"><Icon name="check" size={72} /></div>
        <Confetti />
      </div>
      <div className="center-tx">
        <h2 className="status-title">{t.paidTitle}</h2>
        <p>{t.paidBody(amt, opName(o.operator), o.phone)}</p>
      </div>
      <div className="done-chips">
        {[t.stepQuote, t.stepNimSent, t.stepPaid].map(x => <span key={x} className="chip-ok"><Icon name="check" size={14} />{x}</span>)}
      </div>
      <Details t={t} o={o} />
      <div className="grow" />
      <div className="actions">
        <button className="btn navy primary" onClick={onHome}>{t.done}</button>
        <button className="btn text" onClick={share}>{copied ? t.copied : t.shareReceipt}</button>
      </div>
    </main>
  )
}

function Ussd({ t, o, onHome }: { t: Dict, o: Order, onHome: () => void }) {
  const now = useNow()
  const amt = fmtXaf(o.xaf, t.locale)
  const code = o.operator === 'mtn' ? '*126#' : '#150*50#'
  return (
    <main className="screen ussd">
      <div className="headline">
        <span className="eyebrow">{t.stepOf(2, 3)}</span>
        <h2 className="status-title">{t.ussdTitle}</h2>
        <p>{t.ussdBody(opName(o.operator), amt)}</p>
      </div>
      <div className={`handset ${o.operator}`}>
        <div className="lattice full" />
        <div className="ussd-card">
          <b>{opName(o.operator)}</b>
          <span>{t.ussdCard(amt)}</span>
          <div className="pin">••••</div>
          <div className="ussd-btns"><span>{t.ussdCancel}</span><span>{t.ussdSend}</span></div>
        </div>
      </div>
      <div className="waiting"><span className="spin" />{t.waitingApproval}</div>
      <div className="grow" />
      <section className="card kv">
        <div><span>{t.noPrompt}</span><b>{t.dial(code)}</b></div>
        <div><span>{t.lockedFor}</span><b className="ok">{clock(o.expiresAt - now)}</b></div>
      </section>
      <button className="btn soft" onClick={onHome}>{t.cancelTopUp}</button>
    </main>
  )
}

function Delivered({ t, o, onHome }: { t: Dict, o: Order, onHome: () => void }) {
  return (
    <main className="screen delivered">
      <section className="hero-card center">
        <div className="lattice bl" />
        <Hex className="hex-lg"><Icon name="check" size={48} /></Hex>
        <span className="gold-label">{t.delivered}</span>
        <div className="big"><span className="num">+{fmtNim(o.nimLuna, t.locale)}</span><span className="unit">NIM</span></div>
        <span className="sub">{t.nowInWallet}</span>
      </section>
      <section className="card kv">
        <div><span>{t.paid}</span><b>{fmtXaf(o.xaf, t.locale)}</b></div>
        <div><span>{t.from}</span><b className="from"><i className={o.operator} />{o.phone}</b></div>
        <div><span>{t.fee}</span><b>{fmtXaf(o.feeXaf, t.locale)}</b></div>
        {txLink(o, o.deliveryTx) && <div><span>{t.transaction}</span><b><a href={txLink(o, o.deliveryTx)} target="_blank" rel="noreferrer">{t.viewTx} ↗</a></b></div>}
      </section>
      <Details t={t} o={o} />
      <div className="grow" />
      <button className="btn gold primary" onClick={onHome}>{t.done}</button>
    </main>
  )
}

function Problem({ t, o, onHome, onRetry }: { t: Dict, o: Order, onHome: () => void, onRetry: (k: Kind) => void }) {
  const op = opName(o.operator)
  const s = o.status
  const [title, body, icon] = s === 'refunded'
    ? [t.refundedTitle, t.refundedBody(op, o.phone), 'refund'] as const
    : s === 'refunding'
      ? [t.refundingTitle, t.refundingBody(op, o.phone), 'refund'] as const
      : s === 'payout_failed'
        ? [t.reviewTitle, t.reviewBody, 'shield'] as const
        : s === 'payment_failed'
          ? [t.payFailedTitle, t.payFailedBody(op), 'alert'] as const
          : [t.expiredTitle, t.expiredBody, 'clock'] as const
  const reason = o.error ? o.error[0].toUpperCase() + o.error.slice(1) : null
  const refund = s === 'refunded' || s === 'refunding'
  return (
    <main className="screen problem">
      <div className={`badge-xl ${refund ? 'ok' : s === 'payout_failed' ? 'navy' : 'warm'}`}>
        <div className="in">{s === 'refunding' ? <span className="spin light" /> : <Icon name={icon} size={40} />}</div>
      </div>
      <div className="headline">
        <h2 className="status-title">{title}</h2>
        <p>{body}</p>
      </div>
      <section className="card kv">
        {refund
          ? <div className="base"><span>{s === 'refunded' ? t.refunded : t.refunding}</span><b className="quote-nim pos">{fmtNim(o.nimLuna, t.locale)} <small>NIM</small></b></div>
          : <div><span>{t.amount}</span><b>{fmtXaf(o.xaf, t.locale)}</b></div>}
        {reason && <div><span>{t.reason}</span><b className="wrap">{reason}</b></div>}
        <div><span>{t.reference}</span><b>{o.id}</b></div>
      </section>
      {s !== 'payout_failed' && <div className="info"><Icon name="phone" /><span>{t.tipRetry}</span></div>}
      <Details t={t} o={o} />
      <div className="grow" />
      <div className="actions">
        <button className="btn navy primary" onClick={() => onRetry(o.kind)}>{t.tryAgain}</button>
        <button className="btn text" onClick={onHome}>{t.backHome}</button>
      </div>
    </main>
  )
}

function PreviewSheet({ t, p, onDone }: { t: Dict, p: PendingTx, onDone: () => void }) {
  const answer = (ok: boolean) => { p.resolve(ok); onDone() }
  return (
    <div className="sheet-bg" role="dialog" aria-modal aria-label={t.previewTitle}>
      <div className="sheet">
        <span className="grab" />
        <span className="eyebrow">{t.previewTitle}</span>
        <div className="big"><span className="num">{fmtNim(p.tx.value, t.locale)}</span><span className="unit">NIM</span></div>
        <section className="card kv flat">
          <div><span>{t.previewTo}</span><b className="mono">{p.tx.recipient.slice(0, 14)}…{p.tx.recipient.slice(-4)}</b></div>
          <div><span>{t.previewMemo}</span><b className="mono">{p.tx.data}</b></div>
        </section>
        <button className="btn gold primary" onClick={() => answer(true)}>{t.approve}</button>
        <button className="btn text" onClick={() => answer(false)}>{t.cancel}</button>
      </div>
    </div>
  )
}
