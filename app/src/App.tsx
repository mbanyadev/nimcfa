import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type Health, type Order, type Quote } from './api'
import { dicts, fmtNim, fmtXaf, type Dict } from './i18n'
import { formatPhone, normalize, operatorOf } from './phone'
import { connectWallet, hostLanguage, UserCancelled, type Wallet } from './wallet'

type Tab = 'offramp' | 'onramp' | 'history'
const FINAL = new Set(['paid', 'refunded', 'expired', 'payout_failed', 'delivered', 'payment_failed'])

export default function App() {
  const [lang, setLang] = useState<'en' | 'fr'>(hostLanguage())
  const t = dicts[lang]
  const [wallet, setWallet] = useState<Wallet | null | undefined>(undefined)
  const [address, setAddress] = useState<string | null>(null)
  const [balance, setBalance] = useState<number | null>(null)
  const [health, setHealth] = useState<Health | null>(null)
  const [tab, setTab] = useState<Tab>('offramp')
  const [active, setActive] = useState<Order | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
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

  const networkMismatch = wallet && health && wallet.network !== health.network

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden>₦</span>
          <div>
            <h1>NimCFA</h1>
            <p>{t.tagline}</p>
          </div>
        </div>
        <button className="lang" onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}>{lang === 'en' ? 'FR' : 'EN'}</button>
      </header>

      {health?.sandbox && <div className="banner">{t.sandbox}{health.network === 'testnet' ? ` · ${t.testnet}` : ''}</div>}
      {wallet?.mode === 'preview' && <div className="banner subtle">{t.previewWallet}</div>}
      {networkMismatch && <div className="banner warn">Nimiq Pay is on {wallet!.network}, this service runs on {health!.network}.</div>}

      {wallet === undefined && <div className="card center muted">{t.connecting}</div>}
      {wallet === null && <div className="card center">{t.notInPay}</div>}

      {wallet && !address && (
        <div className="card center">
          <p className="muted">{t.why}</p>
          <button className="primary" onClick={connect}>Connect Nimiq Pay</button>
        </div>
      )}

      {wallet && address && !active && (
        <>
          <div className="acct">
            <span className="addr">{address.slice(0, 9)}…{address.slice(-4)}</span>
            {balance !== null && <span>{t.balance}: <b>{fmtNim(balance)} NIM</b></span>}
          </div>
          <nav className="tabs">
            {(['offramp', 'onramp', 'history'] as Tab[]).map(k => (
              <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
                {k === 'offramp' ? t.cashOut : k === 'onramp' ? t.topUp : t.history}
              </button>
            ))}
          </nav>
          {tab !== 'history' && health && (
            <RampForm key={tab} kind={tab} t={t} health={health} wallet={wallet} address={address}
              balance={balance} onStarted={o => { setActive(o); refreshBalance() }} />
          )}
          {tab === 'history' && <History t={t} address={address} onOpen={setActive} />}
        </>
      )}

      {active && <OrderView t={t} initial={active} onClose={() => { setActive(null); refreshBalance() }} />}
      {err && <div className="error">{err}</div>}
      <footer>Built on Nimiq Pay · {health ? `${health.provider} · ${health.network}` : ''}</footer>
    </div>
  )
}

function RampForm({ kind, t, health, wallet, address, balance, onStarted }: {
  kind: 'offramp' | 'onramp', t: Dict, health: Health, wallet: Wallet, address: string,
  balance: number | null, onStarted: (o: Order) => void
}) {
  const [xafText, setXafText] = useState('2000')
  const [phoneText, setPhoneText] = useState('')
  const [quote, setQuote] = useState<Quote | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const xaf = Number(xafText.replace(/\D/g, '')) || 0
  const phone = normalize(phoneText)
  const op = operatorOf(phone)
  const { minXaf, maxXaf } = health.limits
  const amountOk = xaf >= minXaf && xaf <= maxXaf

  useEffect(() => {
    setQuote(null)
    if (!amountOk) return
    const h = setTimeout(() => { api.quote(kind, xaf).then(setQuote).catch(e => setMsg(e.message)) }, 300)
    return () => clearTimeout(h)
  }, [kind, xaf, amountOk])

  const insufficient = kind === 'offramp' && quote && balance !== null && balance < quote.nimLuna

  async function submit() {
    if (!phone || !op || !amountOk) return
    setBusy(true); setMsg(null)
    try {
      if (kind === 'offramp') {
        const order = await api.offramp({ xaf, phone, userAddress: address })
        setMsg(t.approveInPay)
        let hash: string
        try { hash = await wallet.send({ recipient: order.depositAddress!, value: order.nimLuna, data: order.memo }) }
        catch (e) { if (e instanceof UserCancelled) { setMsg(t.cancelled); return } throw e }
        onStarted(await api.reportDeposit(order.id, hash))
      }
      else {
        onStarted(await api.onramp({ xaf, phone, userAddress: address }))
      }
    }
    catch (e) { setMsg((e as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="card">
      <label className="field">
        <span>{kind === 'offramp' ? t.receive : t.youPay}</span>
        <div className="amount">
          <input inputMode="numeric" value={xafText} onChange={e => setXafText(e.target.value)} aria-label="FCFA" />
          <em>FCFA</em>
        </div>
        {!amountOk && <small className="bad">{t.amountRange(minXaf, maxXaf)}</small>}
      </label>
      <div className="presets">
        {[1000, 5000, 10000, 25000].map(v => <button key={v} onClick={() => setXafText(String(v))}>{v.toLocaleString('fr-FR')}</button>)}
      </div>

      <div className="quote">
        <div><span>{kind === 'offramp' ? t.youSend : t.youGet}</span><b>{quote ? `${fmtNim(quote.nimLuna)} NIM` : '–'}</b></div>
        <div><span>{t.rate}</span><span>{quote ? `1 000 NIM = ${(quote.xafPerNim * 1000).toFixed(0)} FCFA` : '–'}</span></div>
        <div><span>{t.fee}</span><span>{quote ? fmtXaf(quote.feeXaf) : '–'}</span></div>
        <small className="muted">{t.lockedFor}</small>
      </div>

      <label className="field">
        <span>{t.phone}</span>
        <div className="phone">
          <span className="cc">+237</span>
          <input inputMode="tel" placeholder="6 70 00 00 00" value={phoneText} onChange={e => setPhoneText(e.target.value)} />
          {op && <span className={`op ${op}`}>{op === 'mtn' ? 'MTN MoMo' : 'Orange Money'}</span>}
        </div>
        <small className={phoneText && !op ? 'bad' : 'muted'}>{phoneText && !op ? t.invalidPhone : t.phoneHint}</small>
        {phone && op && <small className="muted">{formatPhone(phone)}</small>}
      </label>

      {insufficient && <div className="error">Not enough NIM in this wallet.</div>}
      <button className="primary" disabled={busy || !quote || !op || !!insufficient} onClick={submit}>
        {busy ? '…' : kind === 'offramp' ? t.confirmSend(quote ? fmtNim(quote.nimLuna) : '') : t.pay}
      </button>
      {msg && <p className="note">{msg}</p>}
    </div>
  )
}

function OrderView({ t, initial, onClose }: { t: Dict, initial: Order, onClose: () => void }) {
  const [o, setO] = useState(initial)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    const poll = async () => {
      try {
        const n = await api.order(o.id)
        setO(n)
        if (FINAL.has(n.status)) return
      }
      catch { /* keep polling */ }
      timer.current = window.setTimeout(poll, 2500)
    }
    poll()
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [o.id])
  const final = FINAL.has(o.status)
  const good = o.status === 'paid' || o.status === 'delivered'
  const txLink = (h?: string) => h && /^[0-9a-f]{64}$/.test(h) ? `${o.explorer}${h}` : undefined
  const steps = useMemo(() => o.timeline, [o.timeline])

  return (
    <div className="card">
      <div className={`status ${good ? 'ok' : final ? 'end' : 'live'}`}>
        <b>{t.status[o.status] ?? o.status}</b>
        <span>{o.kind === 'offramp' ? `${fmtNim(o.nimLuna)} NIM → ${fmtXaf(o.xaf)}` : `${fmtXaf(o.xaf)} → ${fmtNim(o.nimLuna)} NIM`}</span>
        <small>{o.operator === 'mtn' ? 'MTN MoMo' : 'Orange Money'} · {o.phone} · #{o.id}</small>
      </div>
      {o.kind === 'onramp' && o.status === 'awaiting_payment' && <p className="note">{t.approvePhone(o.operator)}</p>}
      <ol className="timeline">
        {steps.map((s, i) => (
          <li key={i}>
            <span>{s.label}</span>
            {txLink(s.ref) ? <a href={txLink(s.ref)} target="_blank" rel="noreferrer">tx ↗</a> : s.ref ? <code>{s.ref}</code> : null}
          </li>
        ))}
      </ol>
      {o.error && o.status !== 'paid' && <p className="note">{o.error}</p>}
      <button className={final ? 'primary' : 'ghost'} onClick={onClose}>{final ? t.newOrder : t.back}</button>
    </div>
  )
}

function History({ t, address, onOpen }: { t: Dict, address: string, onOpen: (o: Order) => void }) {
  const [list, setList] = useState<Order[] | null>(null)
  useEffect(() => { api.history(address).then(setList).catch(() => setList([])) }, [address])
  if (!list) return <div className="card center muted">…</div>
  if (!list.length) return <div className="card center muted">{t.noHistory}</div>
  return (
    <ul className="card history">
      {list.map(o => (
        <li key={o.id} onClick={() => onOpen(o)}>
          <div>
            <b>{o.kind === 'offramp' ? t.cashOut : t.topUp}</b>
            <small>{new Date(o.createdAt).toLocaleString()} · {o.operator === 'mtn' ? 'MTN' : 'Orange'}</small>
          </div>
          <div className="right">
            <b>{fmtXaf(o.xaf)}</b>
            <small>{t.status[o.status] ?? o.status}</small>
          </div>
        </li>
      ))}
    </ul>
  )
}
