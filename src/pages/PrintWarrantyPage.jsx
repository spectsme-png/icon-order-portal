import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { WarrantyCardPreview } from '../components/PrintPreviews'
import { markOrderReceived } from '../lib/orderStatus'
import { CARD_PAGE, usePrintPageSize } from '../lib/usePrintPageSize'
import { supabase } from '../lib/supabase'

export default function PrintWarrantyPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const invoiceNo = searchParams.get('invoice') || ''
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  usePrintPageSize(CARD_PAGE)

  useEffect(() => {
    supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setOrder(data)
      })
  }, [id])

  async function doPrint() {
    if (!invoiceNo.trim()) {
      setError('Enter invoice no. on the office page before printing the card.')
      return
    }
    setBusy(true)
    setError('')
    setMsg('')
    try {
      await markOrderReceived(supabase, id)
      setMsg('Status → RECEIVED (optician sees DONE)')
      setOrder((prev) => (prev ? { ...prev, status: 'RECEIVED' } : prev))
      window.print()
    } catch (ex) {
      setError(ex.message || 'Could not update status')
    } finally {
      setBusy(false)
    }
  }

  if (error && !order) {
    return (
      <div className="page">
        <div className="alert">{error}</div>
        <Link to="/office">← Back</Link>
      </div>
    )
  }
  if (!order) return <div className="page muted">Loading…</div>

  return (
    <div className="print-shell print-card">
      <div className="no-print toolbar">
        <Link to="/office">← Back</Link>
        <div>
          <p className="muted small">
            Choose <strong>Evolis Zenius</strong> · CR-80
            {invoiceNo ? (
              <>
                {' '}
                · Invoice <strong>{invoiceNo}</strong>
              </>
            ) : (
              <> · <strong>invoice required</strong></>
            )}
          </p>
          {msg ? <p className="ok-inline">{msg}</p> : null}
          {error ? <p className="alert-inline">{error}</p> : null}
          <button className="btn primary" type="button" onClick={doPrint} disabled={busy}>
            {busy ? 'Updating…' : 'Print card'}
          </button>
        </div>
      </div>

      <div className="warranty-print-wrap warranty-print-exact">
        <div className="card-page">
          <WarrantyCardPreview order={order} invoiceNo={invoiceNo} />
        </div>
      </div>
    </div>
  )
}
