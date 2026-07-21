import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import catalog from '../data/lensCatalog.json'
import { displayOrderStatus, remarksWithoutCancelMark } from '../lib/orderStatus'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const PAGE_SIZE = 50
const CORRIDOR_OPTIONS = ['Short', 'Medium', 'Large']

const emptyEye = () => ({
  size: '70',
  sph: '',
  cyl: '',
  axis: '',
  add: '',
  ipd: '',
  prism: '',
  base: '',
  corridor: '',
  fh: '',
})

const RX_LIMITS = {
  sph: { min: -30, max: 22, step: 0.25, label: 'SPH (−30…+22, 0.25 steps)' },
  cyl: { min: -12, max: 12, step: 0.25, label: 'CYL (−12…+12, 0.25 steps)' },
  axis: { min: 0, max: 180, step: 1, integer: true, label: 'AXIS (0…180, 1° steps)' },
  add: { min: 0.25, max: 4, step: 0.25, positiveOnly: true, label: 'ADD (+0.25…+4.00, 0.25 steps)' },
  ipd: { min: 25, max: 38, step: 1, integer: true, label: 'IPD mono (25…38)' },
  prism: { min: 0, max: 12, step: 1, integer: true, label: 'PRISM (0…12, 1 steps)' },
}

function isIncompleteNumber(raw) {
  const v = String(raw ?? '').trim()
  if (!v) return true
  return /^[+-]?\.?$/.test(v) || /^[+-]?\d+\.$/.test(v)
}

function parseRxNumber(raw) {
  const v = String(raw ?? '').trim()
  if (!v || isIncompleteNumber(v)) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function isOnStep(n, step) {
  if (!step) return true
  const scaled = n / step
  return Math.abs(scaled - Math.round(scaled)) < 1e-8
}

/** Empty / still typing = ok. Out of range, wrong step, or bad format = red. */
function isRxFieldInvalid(field, raw) {
  const v = String(raw ?? '').trim()
  if (!v) return false
  if (field === 'fh') {
    if (isIncompleteNumber(v)) return false
    return Number.isNaN(parseRxNumber(v))
  }
  const rule = RX_LIMITS[field]
  if (!rule) return false
  if (isIncompleteNumber(v)) return false
  const n = parseRxNumber(v)
  if (n === null) return false
  if (Number.isNaN(n)) return true
  if (rule.positiveOnly && n < 0) return true
  if (n < rule.min || n > rule.max) return true
  if (rule.integer && !Number.isInteger(n)) return true
  if (rule.step && !isOnStep(n, rule.step)) return true
  return false
}

function eyeRxErrors(eye) {
  const bad = []
  for (const field of Object.keys(RX_LIMITS)) {
    if (isRxFieldInvalid(field, eye[field])) bad.push(RX_LIMITS[field].label)
  }
  if (isRxFieldInvalid('fh', eye.fh)) bad.push('FH (number)')
  return bad
}

function makeRef() {
  const d = new Date()
  const stamp = d.toISOString().slice(0, 10).replace(/-/g, '')
  const n = Math.floor(1000 + Math.random() * 9000)
  return `CRX-${stamp}-${n}`
}

function numberedOptions(values) {
  return values.map((v, i) => ({ value: v, label: `${i + 1}. ${v}` }))
}

function todayLocal() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dayBounds(dateStr) {
  const start = new Date(`${dateStr}T00:00:00`)
  const end = new Date(`${dateStr}T23:59:59.999`)
  return { start: start.toISOString(), end: end.toISOString() }
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

function eyeLine(eye) {
  if (!eye || typeof eye !== 'object') return '—'
  const bits = [
    `Sz ${eye.size || '—'}`,
    `SPH ${eye.sph || '—'}`,
    `CYL ${eye.cyl || '—'}`,
    `AXIS ${eye.axis || '—'}`,
    `ADD ${eye.add || '—'}`,
    eye.ipd ? `IPD ${eye.ipd}` : null,
    eye.prism ? `PRISM ${eye.prism}` : null,
    eye.base ? `BASE ${eye.base}` : null,
    eye.corridor ? `CORR ${eye.corridor}` : null,
    eye.fh ? `FH ${eye.fh}` : null,
  ].filter(Boolean)
  return bits.join(' · ')
}

export default function OpticianPage() {
  const { profile, user, signOut } = useAuth()
  const formRef = useRef(null)
  const listRef = useRef(null)
  const ordersRef = useRef([])
  const loadingMoreRef = useRef(false)
  const [orderRef, setOrderRef] = useState(makeRef)
  const [customer, setCustomer] = useState('')
  const [branch, setBranch] = useState(profile?.branch_name || 'Main Branch')
  const [lensType, setLensType] = useState('')
  const [design, setDesign] = useState('')
  const [func, setFunc] = useState('')
  const [indexOption, setIndexOption] = useState('')
  const [coating, setCoating] = useState('None')
  const [edging, setEdging] = useState('None')
  const [tinting, setTinting] = useState('None')
  const [tintColor, setTintColor] = useState('')
  const [tintPct, setTintPct] = useState('')
  const [specials, setSpecials] = useState({})
  const [remarks, setRemarks] = useState('')
  const [od, setOd] = useState(emptyEye)
  const [os, setOs] = useState(emptyEye)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const [filterDate, setFilterDate] = useState(todayLocal)
  const [orders, setOrders] = useState([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersLoadingMore, setOrdersLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [ordersErr, setOrdersErr] = useState('')
  const [selected, setSelected] = useState(null)

  const designs = useMemo(() => Object.keys(catalog.matrix[lensType] || {}), [lensType])
  const functions = useMemo(() => Object.keys((catalog.matrix[lensType] || {})[design] || {}), [lensType, design])
  const indexes = useMemo(
    () => ((catalog.matrix[lensType] || {})[design] || {})[func] || [],
    [lensType, design, func],
  )

  useEffect(() => {
    if (design && !designs.includes(design)) setDesign('')
  }, [designs, design])
  useEffect(() => {
    if (func && !functions.includes(func)) setFunc('')
  }, [functions, func])
  useEffect(() => {
    if (indexOption && !indexes.includes(indexOption)) setIndexOption('')
  }, [indexes, indexOption])

  useEffect(() => {
    if (lensType !== 'Progressive') {
      setOd((prev) => (prev.corridor ? { ...prev, corridor: '' } : prev))
      setOs((prev) => (prev.corridor ? { ...prev, corridor: '' } : prev))
    }
  }, [lensType])

  const loadOrders = useCallback(
    async ({ reset = false } = {}) => {
      if (!user?.id) return
      if (!reset && loadingMoreRef.current) return
      if (reset) {
        setOrdersLoading(true)
        setOrdersErr('')
        loadingMoreRef.current = false
      } else {
        loadingMoreRef.current = true
        setOrdersLoadingMore(true)
      }

      const from = reset ? 0 : ordersRef.current.length
      const { start, end } = dayBounds(filterDate)

      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('created_by', user.id)
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1)

      if (error) {
        setOrdersErr(error.message)
        if (reset) {
          setOrders([])
          ordersRef.current = []
        }
        setHasMore(false)
      } else {
        const batch = data || []
        const next = reset ? batch : [...ordersRef.current, ...batch]
        ordersRef.current = next
        setOrders(next)
        setHasMore(batch.length === PAGE_SIZE)
        if (reset) setSelected(null)
      }

      setOrdersLoading(false)
      setOrdersLoadingMore(false)
      loadingMoreRef.current = false
    },
    [user?.id, filterDate],
  )

  useEffect(() => {
    loadOrders({ reset: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterDate, user?.id])

  function onListScroll(e) {
    const el = e.currentTarget
    if (!hasMore || ordersLoadingMore || ordersLoading || loadingMoreRef.current) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) {
      loadOrders({ reset: false })
    }
  }

  function toggleSpecial(name) {
    setSpecials((prev) => ({ ...prev, [name]: !prev[name] }))
  }

  function selectedSpecials() {
    const list = Object.entries(specials)
      .filter(([, v]) => v)
      .map(([k]) => k)
    return list.length ? list.join(', ') : 'None'
  }

  function startNewOrder() {
    setOrderRef(makeRef())
    setCustomer('')
    setBranch(profile?.branch_name || 'Main Branch')
    setLensType('')
    setDesign('')
    setFunc('')
    setIndexOption('')
    setCoating('None')
    setEdging('None')
    setTinting('None')
    setTintColor('')
    setTintPct('')
    setSpecials({})
    setRemarks('')
    setOd(emptyEye())
    setOs(emptyEye())
    setErr('')
    setMsg('')
    setSent(false)
    setSelected(null)
  }

  function focusNextField(current) {
    const root = formRef.current
    if (!root) return
    const fields = [...root.querySelectorAll('[data-nav="1"]')].filter(
      (el) => !el.disabled && el.offsetParent !== null,
    )
    const idx = fields.indexOf(current)
    if (idx >= 0 && idx + 1 < fields.length) {
      const next = fields[idx + 1]
      next.focus()
      if (typeof next.select === 'function') next.select()
    }
  }

  function onFieldKeyDown(e) {
    const el = e.currentTarget

    if (el.tagName === 'SELECT') {
      const digit = e.code?.startsWith('Digit')
        ? e.code.slice(5)
        : e.code?.startsWith('Numpad') && e.code.length === 7
          ? e.code.slice(6)
          : null
      if (digit && digit >= '1' && digit <= '9') {
        const match = [...el.options].find((o) => o.textContent.trim().startsWith(`${digit}.`))
        if (match) {
          e.preventDefault()
          el.value = match.value
          el.dispatchEvent(new Event('change', { bubbles: true }))
          return
        }
      }
    }

    if (e.key === 'Enter') {
      if (el.getAttribute('data-nav-end') === '1') return
      e.preventDefault()
      focusNextField(el)
    }
  }

  const isProgressive = lensType === 'Progressive'
  const showTintDetails = tinting === 'Full' || tinting === 'Gradient'

  async function submit(e) {
    e.preventDefault()
    if (sent) return
    setErr('')
    setMsg('')
    if (!customer.trim()) {
      setErr('Customer name is required')
      return
    }
    if (!orderRef.trim()) {
      setErr('Order reference is required')
      return
    }
    if (!lensType || !design || !func || !indexOption) {
      setErr('Select Type, Design, Function, and Index (1–9 or click)')
      return
    }
    const odBad = eyeRxErrors(od)
    const osBad = eyeRxErrors(os)
    if (odBad.length || osBad.length) {
      const parts = []
      if (odBad.length) parts.push(`OD: ${odBad.join(', ')}`)
      if (osBad.length) parts.push(`OS: ${osBad.join(', ')}`)
      setErr(`Fix prescription values — ${parts.join(' · ')}`)
      return
    }
    if (isProgressive && (!od.corridor || !os.corridor)) {
      setErr('Select corridor length for OD and OS (Short / Medium / Large)')
      return
    }
    setBusy(true)
    try {
      const ref = orderRef.trim()
      const { data: existing, error: checkErr } = await supabase
        .from('orders')
        .select('id')
        .eq('order_ref', ref)
        .limit(1)
      if (checkErr) throw checkErr
      if (existing?.length) {
        setErr(`Order reference ${ref} was already sent. Use New Order for a new ref.`)
        return
      }

      const payload = {
        order_ref: ref,
        status: 'NEW',
        created_by: user.id,
        branch_name: branch.trim(),
        customer_name: customer.trim(),
        lens_type: lensType,
        design,
        func,
        index_option: indexOption,
        coating,
        edging,
        tinting,
        tint_color: tinting === 'None' ? '' : tintColor,
        tint_pct: tinting === 'None' ? '' : tintPct,
        specials: selectedSpecials(),
        remarks: remarks.trim(),
        od: {
          ...od,
          sph: od.sph || '0.00',
          cyl: od.cyl || '0.00',
          axis: od.axis || '0',
          add: od.add || '0.00',
          corridor: isProgressive ? od.corridor : '',
        },
        os: {
          ...os,
          sph: os.sph || '0.00',
          cyl: os.cyl || '0.00',
          axis: os.axis || '0',
          add: os.add || '0.00',
          corridor: isProgressive ? os.corridor : '',
        },
      }
      const { error } = await supabase.from('orders').insert(payload)
      if (error) {
        if (/duplicate|unique/i.test(error.message)) {
          setErr(`Order reference ${ref} was already sent. Use New Order for a new ref.`)
          return
        }
        throw error
      }
      setSent(true)
      setMsg(`Order ${ref} sent to Aynai.`)
      setFilterDate(todayLocal())
      await loadOrders({ reset: true })
    } catch (ex) {
      setErr(ex.message || 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  function setBothCorridor(value) {
    setOd((prev) => ({ ...prev, corridor: value }))
    setOs((prev) => ({ ...prev, corridor: value }))
  }

  function setBothFh(value) {
    setOd((prev) => ({ ...prev, fh: value }))
    setOs((prev) => ({ ...prev, fh: value }))
  }

  function renderEyeRow(label, eye, setEye) {
    const fields = ['sph', 'cyl', 'axis', 'add', 'ipd', 'prism']
    return (
      <tr>
        <td className="eye-label">{label}</td>
        <td>
          <select
            data-nav="1"
            value={eye.size}
            onChange={(e) => setEye({ ...eye, size: e.target.value })}
            onKeyDown={onFieldKeyDown}
          >
            {numberedOptions(catalog.sizes).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </td>
        {fields.map((k) => {
          const bad = isRxFieldInvalid(k, eye[k])
          return (
            <td key={k} className={bad ? 'rx-bad' : undefined}>
              <input
                data-nav="1"
                inputMode="decimal"
                autoComplete="off"
                value={eye[k]}
                onChange={(e) => setEye({ ...eye, [k]: e.target.value })}
                onKeyDown={onFieldKeyDown}
                aria-invalid={bad}
              />
            </td>
          )
        })}
        <td>
          <select
            data-nav="1"
            value={eye.base}
            onChange={(e) => setEye({ ...eye, base: e.target.value })}
            onKeyDown={onFieldKeyDown}
          >
            <option value="">—</option>
            {numberedOptions(['IN', 'OUT', 'UP', 'DOWN']).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </td>
        {isProgressive ? (
          <td>
            <select
              data-nav="1"
              value={eye.corridor}
              onChange={(e) => setBothCorridor(e.target.value)}
              onKeyDown={onFieldKeyDown}
            >
              <option value="">—</option>
              {numberedOptions(CORRIDOR_OPTIONS).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </td>
        ) : null}
        <td className={isRxFieldInvalid('fh', eye.fh) ? 'rx-bad' : undefined}>
          <input
            data-nav="1"
            inputMode="decimal"
            autoComplete="off"
            value={eye.fh}
            onChange={(e) => setBothFh(e.target.value)}
            onKeyDown={onFieldKeyDown}
            placeholder="opt"
          />
        </td>
      </tr>
    )
  }

  return (
    <div className="app-shell optician-shell">
      <header className="topbar topbar-slim">
        <strong>ICON Order Portal · Optician</strong>
        <div className="topbar-right">
          <button className="btn primary btn-slim" type="button" onClick={startNewOrder}>
            New Order
          </button>
          <span className="hint">Enter = next · 1–9 = pick dropdown</span>
          <span className="muted small">{profile?.email}</span>
          <button className="btn ghost btn-slim" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="optician-workspace">
        <form className="optician-page" onSubmit={submit} ref={formRef}>
          <fieldset className="optician-fieldset" disabled={sent}>
          <div className="optician-grid">
            <section className="card card-slim">
              <div className="row-between section-head">
                <h2>Customer</h2>
                {sent ? <span className="ok-inline">Order sent — press New Order for next</span> : null}
              </div>
              <div className="grid-3">
                <label>
                  Order ref
                  <input
                    data-nav="1"
                    value={orderRef}
                    onChange={(e) => setOrderRef(e.target.value)}
                    onKeyDown={onFieldKeyDown}
                    required
                    readOnly={sent}
                  />
                </label>
                <label>
                  Branch
                  <input
                    data-nav="1"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    onKeyDown={onFieldKeyDown}
                  />
                </label>
                <label>
                  Customer
                  <input
                    data-nav="1"
                    value={customer}
                    onChange={(e) => setCustomer(e.target.value)}
                    onKeyDown={onFieldKeyDown}
                    required
                  />
                </label>
              </div>
            </section>

            <section className="card card-slim">
              <h2>Lens</h2>
              <div className="grid-4">
                <label>
                  1. Type
                  <select
                    data-nav="1"
                    value={lensType}
                    onChange={(e) => {
                      setLensType(e.target.value)
                      setDesign('')
                      setFunc('')
                      setIndexOption('')
                    }}
                    onKeyDown={onFieldKeyDown}
                  >
                    <option value="">—</option>
                    {numberedOptions(Object.keys(catalog.matrix)).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  2. Design
                  <select
                    data-nav="1"
                    value={design}
                    onChange={(e) => {
                      setDesign(e.target.value)
                      setFunc('')
                      setIndexOption('')
                    }}
                    onKeyDown={onFieldKeyDown}
                    disabled={!lensType}
                  >
                    <option value="">—</option>
                    {numberedOptions(designs).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  3. Function
                  <select
                    data-nav="1"
                    value={func}
                    onChange={(e) => {
                      setFunc(e.target.value)
                      setIndexOption('')
                    }}
                    onKeyDown={onFieldKeyDown}
                    disabled={!design}
                  >
                    <option value="">—</option>
                    {numberedOptions(functions).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  4. Index
                  <select
                    data-nav="1"
                    value={indexOption}
                    onChange={(e) => setIndexOption(e.target.value)}
                    onKeyDown={onFieldKeyDown}
                    disabled={!func}
                  >
                    <option value="">—</option>
                    {numberedOptions(indexes).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="card card-slim">
              <h2>Finishing</h2>
              <div className="grid-finish">
                <label>
                  5. Coating
                  <select
                    data-nav="1"
                    value={coating}
                    onChange={(e) => setCoating(e.target.value)}
                    onKeyDown={onFieldKeyDown}
                  >
                    {numberedOptions(catalog.coating).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  6. Edging
                  <select
                    data-nav="1"
                    value={edging}
                    onChange={(e) => setEdging(e.target.value)}
                    onKeyDown={onFieldKeyDown}
                  >
                    {numberedOptions(catalog.edging).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="tint-field">
                  7. Tinting
                  <div className="tint-inline">
                    <select
                      data-nav="1"
                      value={tinting}
                      onChange={(e) => {
                        setTinting(e.target.value)
                        if (e.target.value === 'None') {
                          setTintColor('')
                          setTintPct('')
                        }
                      }}
                      onKeyDown={onFieldKeyDown}
                    >
                      {numberedOptions(catalog.tinting).map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    {showTintDetails ? (
                      <>
                        <input
                          data-nav="1"
                          className="tint-color"
                          value={tintColor}
                          onChange={(e) => setTintColor(e.target.value)}
                          onKeyDown={onFieldKeyDown}
                          placeholder="Color"
                          aria-label="Tint color"
                        />
                        <input
                          data-nav="1"
                          className="tint-pct"
                          value={tintPct}
                          onChange={(e) => setTintPct(e.target.value)}
                          onKeyDown={onFieldKeyDown}
                          placeholder="%"
                          aria-label="Tint percent"
                        />
                      </>
                    ) : null}
                  </div>
                </label>
              </div>
              <div className="specials-slim">
                <span className="muted small">Special</span>
                <div className="checks-slim">
                  {catalog.special.map((s) => (
                    <label key={s} className="check">
                      <input type="checkbox" checked={!!specials[s]} onChange={() => toggleSpecial(s)} />
                      <span>{s}</span>
                    </label>
                  ))}
                </div>
              </div>
            </section>

            <section className="card card-slim">
              <h2>Prescription</h2>
              <div className="table-wrap">
                <table className="rx-table rx-table-slim">
                  <thead>
                    <tr>
                      <th>Eye</th>
                      <th>SIZE</th>
                      <th>SPH</th>
                      <th>CYL</th>
                      <th>AXIS</th>
                      <th>ADD</th>
                      <th>IPD mono</th>
                      <th>PRISM</th>
                      <th>BASE</th>
                      {isProgressive ? <th>CORR</th> : null}
                      <th>FH</th>
                    </tr>
                  </thead>
                  <tbody>
                    {renderEyeRow('OD', od, setOd)}
                    {renderEyeRow('OS', os, setOs)}
                  </tbody>
                </table>
              </div>
              <div className="remarks-row">
                <label>
                  Remarks
                  <input
                    data-nav="1"
                    data-nav-end="1"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    onKeyDown={onFieldKeyDown}
                    placeholder="Aynai only"
                  />
                </label>
              </div>
            </section>
          </div>
          </fieldset>
          <div className="send-bar">
            {err ? <span className="alert-inline">{err}</span> : null}
            {msg ? <span className="ok-inline">{msg}</span> : null}
            <button
              className={`btn btn-slim ${sent ? 'btn-sent' : 'primary'}`}
              type="submit"
              disabled={busy || sent}
            >
              {busy ? 'Sending…' : sent ? 'Order sent' : 'Send to Aynai'}
            </button>
          </div>
        </form>

        <aside className="orders-panel card card-slim">
          <div className="orders-panel-head">
            <h2>My orders</h2>
            <label className="date-filter">
              Date
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value || todayLocal())}
              />
            </label>
          </div>
          <p className="hint orders-hint">
            Showing {orders.length}
            {hasMore ? '+' : ''} · click to view (read-only)
          </p>

          {ordersErr ? <div className="alert-inline">{ordersErr}</div> : null}

          {selected ? (
            <div className="order-readonly">
              <div className="order-readonly-bar">
                <strong>{selected.order_ref}</strong>
                <button className="btn ghost btn-slim" type="button" onClick={() => setSelected(null)}>
                  Back to list
                </button>
              </div>
              <div className="order-readonly-body">
                <dl className="ro-grid">
                  <div>
                    <dt>Status</dt>
                    <dd>{displayOrderStatus(selected, 'optician')}</dd>
                  </div>
                  <div>
                    <dt>Time</dt>
                    <dd>{formatTime(selected.created_at)}</dd>
                  </div>
                  <div>
                    <dt>Customer</dt>
                    <dd>{selected.customer_name}</dd>
                  </div>
                  <div>
                    <dt>Branch</dt>
                    <dd>{selected.branch_name || '—'}</dd>
                  </div>
                  <div>
                    <dt>Type</dt>
                    <dd>{selected.lens_type || '—'}</dd>
                  </div>
                  <div>
                    <dt>Design</dt>
                    <dd>{selected.design || '—'}</dd>
                  </div>
                  <div>
                    <dt>Function</dt>
                    <dd>{selected.func || '—'}</dd>
                  </div>
                  <div>
                    <dt>Index</dt>
                    <dd>{selected.index_option || '—'}</dd>
                  </div>
                  <div>
                    <dt>Coating</dt>
                    <dd>{selected.coating || '—'}</dd>
                  </div>
                  <div>
                    <dt>Edging</dt>
                    <dd>{selected.edging || '—'}</dd>
                  </div>
                  <div>
                    <dt>Tinting</dt>
                    <dd>
                      {selected.tinting || '—'}
                      {selected.tint_color ? ` · ${selected.tint_color}` : ''}
                      {selected.tint_pct ? ` ${selected.tint_pct}%` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Specials</dt>
                    <dd>{selected.specials || 'None'}</dd>
                  </div>
                  <div className="ro-full">
                    <dt>OD</dt>
                    <dd>{eyeLine(selected.od)}</dd>
                  </div>
                  <div className="ro-full">
                    <dt>OS</dt>
                    <dd>{eyeLine(selected.os)}</dd>
                  </div>
                  <div className="ro-full">
                    <dt>Remarks</dt>
                    <dd>{remarksWithoutCancelMark(selected.remarks) || '—'}</dd>
                  </div>
                </dl>
              </div>
            </div>
          ) : (
            <div className="orders-list" ref={listRef} onScroll={onListScroll}>
              {ordersLoading ? <p className="muted small">Loading…</p> : null}
              {!ordersLoading && orders.length === 0 ? (
                <p className="muted small">No orders on this day.</p>
              ) : null}
              {orders.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="order-row"
                  onClick={() => setSelected(o)}
                >
                  <span className="order-row-ref">{o.order_ref}</span>
                  <span className="order-row-name">{o.customer_name}</span>
                  <span className="order-row-meta">
                    <span className={`status-pill status-${displayOrderStatus(o, 'optician')}`}>
                      {displayOrderStatus(o, 'optician')}
                    </span>
                    <span className="muted small">{formatTime(o.created_at)}</span>
                  </span>
                </button>
              ))}
              {ordersLoadingMore ? <p className="muted small">Loading more…</p> : null}
              {!ordersLoading && !hasMore && orders.length > 0 ? (
                <p className="muted small orders-end">End of list</p>
              ) : null}
              {hasMore ? <p className="muted small orders-end">Scroll for more</p> : null}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
