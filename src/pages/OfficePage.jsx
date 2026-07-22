import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LabelPreview, WarrantyCardPreview, lensLine, tintLabel } from '../components/PrintPreviews'
import {
  displayOrderStatus,
  getInvoiceNo,
  isInvoiceLocked,
  isOrderCancelled,
  remarksWithCancelMark,
  remarksWithoutCancelMark,
} from '../lib/orderStatus'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

const PAGE_SIZE = 50

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

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: '2-digit',
    })
  } catch {
    return ''
  }
}

export default function OfficePage() {
  const { profile, signOut } = useAuth()
  const listRef = useRef(null)
  const ordersRef = useRef([])
  const loadingMoreRef = useRef(false)
  const selectedIdRef = useRef(null)

  const [filterDate, setFilterDate] = useState(todayLocal)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [cancelling, setCancelling] = useState(false)
  const [invoiceByOrder, setInvoiceByOrder] = useState({})

  const loadOrders = useCallback(async ({ reset = false, keepSelection = false } = {}) => {
    if (!reset && loadingMoreRef.current) return
    if (reset) {
      setLoading(true)
      setError('')
      loadingMoreRef.current = false
    } else {
      loadingMoreRef.current = true
      setLoadingMore(true)
    }

    const from = reset ? 0 : ordersRef.current.length
    const { start, end } = dayBounds(filterDate)

    const { data, error: err } = await supabase
      .from('orders')
      .select('*')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (err) {
      setError(err.message)
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
      if (reset && !keepSelection) {
        setSelected(null)
        selectedIdRef.current = null
      } else if (selectedIdRef.current) {
        const fresh = next.find((o) => o.id === selectedIdRef.current)
        if (fresh) setSelected(fresh)
      }
    }

    setLoading(false)
    setLoadingMore(false)
    loadingMoreRef.current = false
  }, [filterDate])

  useEffect(() => {
    loadOrders({ reset: true })
    const channel = supabase
      .channel('office-orders-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        loadOrders({ reset: true, keepSelection: true })
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [loadOrders])

  function selectOrder(o) {
    selectedIdRef.current = o.id
    setSelected(o)
  }

  async function cancelOrder(order) {
    if (!order || isOrderCancelled(order)) return
    const ok = window.confirm(
      `Cancel order ${order.order_ref}?\n\nOptician will still see it as CANCELLED.`,
    )
    if (!ok) return
    setCancelling(true)
    setError('')
    try {
      // Prefer real CANCELLED status if DB allows it; otherwise mark via remarks (no SQL needed).
      let next = { ...order, status: 'CANCELLED' }
      const { error: statusErr } = await supabase
        .from('orders')
        .update({ status: 'CANCELLED' })
        .eq('id', order.id)

      if (statusErr) {
        if (!/orders_status_check|check constraint/i.test(statusErr.message || '')) {
          throw statusErr
        }
        const markedRemarks = remarksWithCancelMark(order.remarks)
        const { error: markErr } = await supabase
          .from('orders')
          .update({ remarks: markedRemarks })
          .eq('id', order.id)
        if (markErr) throw markErr
        next = { ...order, remarks: markedRemarks }
      }

      setSelected(next)
      setOrders((prev) => prev.map((o) => (o.id === order.id ? next : o)))
      ordersRef.current = ordersRef.current.map((o) => (o.id === order.id ? next : o))
    } catch (ex) {
      setError(ex.message || 'Cancel failed')
    } finally {
      setCancelling(false)
    }
  }

  function onListScroll(e) {
    const el = e.currentTarget
    if (!hasMore || loadingMore || loading || loadingMoreRef.current) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 48) {
      loadOrders({ reset: false })
    }
  }

  const od = selected?.od || {}
  const os = selected?.os || {}
  const savedInvoice = selected ? getInvoiceNo(selected) : ''
  const invoiceLocked = selected ? isInvoiceLocked(selected) : false
  const invoiceNo = invoiceLocked
    ? savedInvoice
    : selected
      ? invoiceByOrder[selected.id] ?? savedInvoice
      : ''

  function setInvoiceNo(value) {
    if (!selected || invoiceLocked) return
    setInvoiceByOrder((prev) => ({ ...prev, [selected.id]: value }))
  }

  function printPath(kind) {
    if (!selected) return '#'
    const inv = invoiceNo.trim()
    const q = inv ? `?invoice=${encodeURIComponent(inv)}` : ''
    return `/office/print/${kind}/${selected.id}${q}`
  }

  return (
    <div className="app-shell office-shell">
      <header className="topbar topbar-slim">
        <div>
          <strong>ICON · Aynai</strong>
          <div className="muted small">Receive & print · read-only</div>
        </div>
        <div className="topbar-right">
          <span className="muted small">{profile?.email}</span>
          <button className="btn ghost btn-slim" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>

      <div className="office-workspace">
        <aside className="office-list-panel card card-slim">
          <div className="orders-panel-head">
            <h2>Received orders</h2>
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
            {orders.length}
            {hasMore ? '+' : ''} orders · select to preview card & labels
          </p>
          {error ? <div className="alert-inline">{error}</div> : null}

          <div className="orders-list" ref={listRef} onScroll={onListScroll}>
            {loading ? <p className="muted small">Loading…</p> : null}
            {!loading && orders.length === 0 ? (
              <p className="muted small">No orders on this day.</p>
            ) : null}
            {orders.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`order-row ${selected?.id === o.id ? 'active' : ''}`}
                onClick={() => selectOrder(o)}
              >
                <span className="order-row-ref">{o.order_ref}</span>
                <span className="order-row-name">{o.customer_name}</span>
                <span className="order-row-meta">
                  <span className={`status-pill status-${displayOrderStatus(o)}`}>
                    {displayOrderStatus(o)}
                  </span>
                  <span className="muted small">{formatTime(o.created_at)}</span>
                </span>
              </button>
            ))}
            {loadingMore ? <p className="muted small">Loading more…</p> : null}
            {hasMore ? <p className="muted small orders-end">Scroll for more</p> : null}
          </div>
        </aside>

        <section className="office-detail-panel card card-slim">
          {!selected ? (
            <div className="office-empty">
              <h2>Print preview</h2>
              <p className="muted">Select an order from the left. Orders are view-only — no edits.</p>
              <p className="muted small">
                Card → Evolis Zenius (CR-80) · Labels → Zebra ZD421 (76×76 mm)
              </p>
            </div>
          ) : (
            <>
              <div className="office-detail-bar">
                <div>
                  <h2>{selected.order_ref}</h2>
                  <div className="muted small">
                    {selected.customer_name} · {selected.branch_name || '—'} ·{' '}
                    {formatDate(selected.created_at)}
                  </div>
                </div>
                <div className="office-detail-actions">
                  <span className={`status-pill status-${displayOrderStatus(selected)}`}>
                    {displayOrderStatus(selected)}
                  </span>
                  {!isOrderCancelled(selected) ? (
                    <>
                      <label className="invoice-field">
                        Invoice no.
                        <input
                          value={invoiceNo}
                          onChange={(e) => setInvoiceNo(e.target.value)}
                          placeholder="Enter invoice #"
                          readOnly={invoiceLocked}
                          disabled={invoiceLocked}
                          title={invoiceLocked ? 'Locked after printing card' : ''}
                        />
                      </label>
                      {invoiceLocked ? (
                        <span className="ok-inline">Invoice locked</span>
                      ) : null}
                      <Link
                        className={`btn primary btn-slim ${!invoiceNo.trim() ? 'btn-disabled' : ''}`}
                        to={invoiceNo.trim() ? printPath('warranty') : '#'}
                        onClick={(e) => {
                          if (!invoiceNo.trim()) {
                            e.preventDefault()
                            setError('Enter invoice no. before printing')
                          }
                        }}
                      >
                        Print card
                      </Link>
                      <Link
                        className={`btn ghost btn-slim ${!invoiceNo.trim() ? 'btn-disabled' : ''}`}
                        to={invoiceNo.trim() ? printPath('stickers') : '#'}
                        onClick={(e) => {
                          if (!invoiceNo.trim()) {
                            e.preventDefault()
                            setError(
                              invoiceLocked
                                ? 'Invoice missing on this order'
                                : 'Enter invoice no. and print card first',
                            )
                          }
                        }}
                      >
                        Print labels
                      </Link>
                      <button
                        type="button"
                        className="btn btn-slim btn-danger"
                        onClick={() => cancelOrder(selected)}
                        disabled={cancelling}
                      >
                        {cancelling ? 'Cancelling…' : 'Cancel order'}
                      </button>
                    </>
                  ) : (
                    <span className="muted small">Cancelled — still visible to optician</span>
                  )}
                </div>
              </div>

              <div className="office-detail-scroll">
                <dl className="ro-grid office-meta">
                  <div>
                    <dt>Lens</dt>
                    <dd>{lensLine(selected)}</dd>
                  </div>
                  <div>
                    <dt>Edging</dt>
                    <dd>{selected.edging || '—'}</dd>
                  </div>
                  <div>
                    <dt>Tint</dt>
                    <dd>{tintLabel(selected)}</dd>
                  </div>
                  <div>
                    <dt>Specials</dt>
                    <dd>{selected.specials || 'None'}</dd>
                  </div>
                  {remarksWithoutCancelMark(selected.remarks) ? (
                    <div className="ro-full">
                      <dt>Remarks</dt>
                      <dd>{remarksWithoutCancelMark(selected.remarks)}</dd>
                    </div>
                  ) : null}
                </dl>

                <h3 className="preview-heading">Warranty card (Zenius CR-80)</h3>
                <div className="preview-scale">
                  <WarrantyCardPreview order={selected} invoiceNo={invoiceNo} />
                </div>

                <h3 className="preview-heading">Labels (Zebra ZD421 · 76×76 mm · R then L)</h3>
                <div className="label-preview-row">
                  <LabelPreview order={selected} side="R" eye={od} invoiceNo={invoiceNo} />
                  <LabelPreview order={selected} side="L" eye={os} invoiceNo={invoiceNo} />
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
