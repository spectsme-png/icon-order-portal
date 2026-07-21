/** Marker stored in remarks when DB status check does not allow CANCELLED yet */
export const CANCEL_MARK = '⟦CANCELLED⟧'

export function isOrderCancelled(order) {
  if (!order) return false
  if (order.status === 'CANCELLED') return true
  return String(order.remarks || '').startsWith(CANCEL_MARK)
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
  const r = String(remarks || '')
  return r.startsWith(CANCEL_MARK) ? r.slice(CANCEL_MARK.length) : r
}

export function remarksWithCancelMark(remarks) {
  const r = String(remarks || '')
  return r.startsWith(CANCEL_MARK) ? r : `${CANCEL_MARK}${r}`
}

/** Mark order received after office prints card/labels (with invoice). */
export async function markOrderReceived(supabase, orderId) {
  const { error } = await supabase
    .from('orders')
    .update({ status: 'RECEIVED' })
    .eq('id', orderId)
    .neq('status', 'CANCELLED')
  if (error) throw error
}
