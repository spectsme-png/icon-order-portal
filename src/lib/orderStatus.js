/** Marker stored in remarks when DB status check does not allow CANCELLED yet */
export const CANCEL_MARK = '⟦CANCELLED⟧'
const INV_RE = /^⟦INV:([^\]]*)⟧/

function stripInvoiceMark(remarks) {
  return String(remarks || '').replace(INV_RE, '')
}

function stripCancelMark(remarks) {
  const r = String(remarks || '')
  return r.startsWith(CANCEL_MARK) ? r.slice(CANCEL_MARK.length) : r
}

export function isOrderCancelled(order) {
  if (!order) return false
  if (order.status === 'CANCELLED') return true
  return String(order.remarks || '').startsWith(CANCEL_MARK)
}

/** Saved invoice from column or remarks marker ⟦INV:123⟧ */
export function getInvoiceNo(order) {
  if (!order) return ''
  if (order.invoice_no) return String(order.invoice_no).trim()
  let r = String(order.remarks || '')
  if (r.startsWith(CANCEL_MARK)) r = r.slice(CANCEL_MARK.length)
  const m = r.match(INV_RE)
  return m ? String(m[1] || '').trim() : ''
}

export function isInvoiceLocked(order) {
  return Boolean(getInvoiceNo(order)) || ['RECEIVED', 'PRINTED', 'DONE'].includes(order?.status)
}

/**
 * @param {'office'|'optician'} [viewer]
 * Office sees RECEIVED; optician sees that as DONE (green).
 */
export function displayOrderStatus(order, viewer = 'office') {
  if (isOrderCancelled(order)) return 'CANCELLED'
  const status = order?.status || '—'
  if (viewer === 'optician' && (status === 'RECEIVED' || status === 'PRINTED')) {
    return 'DONE'
  }
  return status
}

export function remarksWithoutCancelMark(remarks) {
  return stripInvoiceMark(stripCancelMark(remarks))
}

export function remarksWithCancelMark(remarks) {
  const text = remarksWithoutCancelMark(remarks)
  const inv = (() => {
    let r = String(remarks || '')
    if (r.startsWith(CANCEL_MARK)) r = r.slice(CANCEL_MARK.length)
    const m = r.match(INV_RE)
    return m ? m[0] : ''
  })()
  return `${CANCEL_MARK}${inv}${text}`
}

function remarksWithInvoice(remarks, invoice) {
  const cancelled = String(remarks || '').startsWith(CANCEL_MARK)
  const text = remarksWithoutCancelMark(remarks)
  const inv = `⟦INV:${String(invoice).trim()}⟧`
  return cancelled ? `${CANCEL_MARK}${inv}${text}` : `${inv}${text}`
}

/**
 * Save invoice (locked) + mark RECEIVED after office prints card.
 * Tries invoice_no column; falls back to remarks marker if column missing.
 */
export async function markOrderReceived(supabase, orderId, invoiceNo, currentRemarks = '') {
  const invoice = String(invoiceNo || '').trim()
  if (!invoice) throw new Error('Invoice number is required')

  const base = {
    status: 'RECEIVED',
    invoice_no: invoice,
  }

  let { error } = await supabase
    .from('orders')
    .update(base)
    .eq('id', orderId)
    .neq('status', 'CANCELLED')

  if (error && /invoice_no|schema cache|column/i.test(error.message || '')) {
    const { error: fallbackErr } = await supabase
      .from('orders')
      .update({
        status: 'RECEIVED',
        remarks: remarksWithInvoice(currentRemarks, invoice),
      })
      .eq('id', orderId)
      .neq('status', 'CANCELLED')
    if (fallbackErr) throw fallbackErr
    return { invoice_no: invoice, remarks: remarksWithInvoice(currentRemarks, invoice), usedRemarksFallback: true }
  }

  if (error) throw error
  return { invoice_no: invoice, usedRemarksFallback: false }
}
