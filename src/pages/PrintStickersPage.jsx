import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { LabelPreview } from '../components/PrintPreviews'
import { getInvoiceNo } from '../lib/orderStatus'
import { LABEL_PAGE, usePrintPageSize } from '../lib/usePrintPageSize'
import { supabase } from '../lib/supabase'

export default function PrintStickersPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const [order, setOrder] = useState(null)
  const [error, setError] = useState('')

  const queryInvoice = searchParams.get('invoice') || ''
  const invoiceNo = (queryInvoice || getInvoiceNo(order) || '').trim()

  usePrintPageSize(LABEL_PAGE)

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

  function doPrint() {
    if (!invoiceNo) {
      setError('Print the card first (with invoice no.) — invoice is required on labels too.')
      return
    }
    setError('')
    window.print()
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

  const od = order.od || {}
  const os = order.os || {}

  return (
    <div className="print-shell print-labels">
      <div className="no-print toolbar">
        <Link to="/office">← Back</Link>
        <div>
          <p className="muted small">
            Choose <strong>Zebra ZD421</strong> · 76×76 mm · R then L
            {invoiceNo ? (
              <>
                {' '}
                · Invoice <strong>{invoiceNo}</strong>
              </>
            ) : (
              <> · <strong>print card first to lock invoice</strong></>
            )}
          </p>
          {error ? <p className="alert-inline">{error}</p> : null}
          <button className="btn primary" type="button" onClick={doPrint} disabled={!invoiceNo}>
            Print labels
          </button>
        </div>
      </div>

      <div className="sticker-sheet sticker-sheet-exact">
        <div className="label-page">
          <LabelPreview order={order} side="R" eye={od} invoiceNo={invoiceNo} />
        </div>
        <div className="label-page">
          <LabelPreview order={order} side="L" eye={os} invoiceNo={invoiceNo} />
        </div>
      </div>
    </div>
  )
}
