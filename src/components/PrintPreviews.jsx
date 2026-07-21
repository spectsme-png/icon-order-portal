import { useEffect, useRef } from 'react'
import JsBarcode from 'jsbarcode'

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

function formatLot(iso) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
  } catch {
    return ''
  }
}

export function tintLabel(o) {
  if (!o?.tinting || o.tinting === 'None') return 'None'
  const parts = [o.tinting]
  if (o.tint_color) parts.push(o.tint_color)
  if (o.tint_pct) parts.push(`${o.tint_pct}%`)
  return parts.join(' / ')
}

export function lensLine(o) {
  const parts = [o.lens_type, o.design, o.func, o.index_option, o.coating].filter(Boolean)
  return parts.join(' ') || '—'
}

/** Compact lens title for sticker header, e.g. "Clex Perfect Sv 1.61" */
export function stickerLensTitle(o) {
  const parts = [o.design || o.lens_type, o.func, o.index_option].filter((p) => p && p !== 'None')
  return parts.join(' ') || o.lens_type || '—'
}

function eyeVal(eye, key, fallback = '') {
  if (!eye || eye[key] === undefined || eye[key] === null || eye[key] === '') return fallback
  return String(eye[key])
}

function RxTable({ od, os }) {
  return (
    <table className="wc-rx">
      <thead>
        <tr>
          <th>Eye</th>
          <th>Sph</th>
          <th>Cyl</th>
          <th>Axis</th>
          <th>Add</th>
          <th>IPD</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>R</td>
          <td>{eyeVal(od, 'sph', '—')}</td>
          <td>{eyeVal(od, 'cyl', '—')}</td>
          <td>{eyeVal(od, 'axis', '—')}</td>
          <td>{eyeVal(od, 'add', '')}</td>
          <td>{eyeVal(od, 'ipd', '')}</td>
        </tr>
        <tr>
          <td>L</td>
          <td>{eyeVal(os, 'sph', '—')}</td>
          <td>{eyeVal(os, 'cyl', '—')}</td>
          <td>{eyeVal(os, 'axis', '—')}</td>
          <td>{eyeVal(os, 'add', '')}</td>
          <td>{eyeVal(os, 'ipd', '')}</td>
        </tr>
      </tbody>
    </table>
  )
}

export function WarrantyCardPreview({ order, invoiceNo = '' }) {
  const od = order.od || {}
  const os = order.os || {}
  const date = formatDate(order.created_at)
  const invoice = String(invoiceNo || '').trim()

  return (
    <div className="warranty-card zenius-card">
      <div className="wc-fields">
        <div className="wc-line">
          <span className="wc-k">Name:</span>
          <span className="wc-v">{order.customer_name}</span>
        </div>
        <div className="wc-line">
          <span className="wc-k">Date:</span>
          <span className="wc-v">{date}</span>
        </div>
        <div className="wc-line">
          <span className="wc-k">Optician:</span>
          <span className="wc-v">{order.branch_name || '—'}</span>
        </div>
        {invoice ? (
          <div className="wc-ref-row">
            <span className="wc-k">Ref. No:</span>
            <span className="wc-v mono">{order.order_ref}</span>
            <span className="wc-k">Invoice:</span>
            <span className="wc-v mono">{invoice}</span>
          </div>
        ) : (
          <div className="wc-line">
            <span className="wc-k">Ref. No:</span>
            <span className="wc-v mono">{order.order_ref}</span>
          </div>
        )}
        <div className="wc-line wc-lens">
          <span className="wc-k">Lens Type:</span>
          <span className="wc-v">{lensLine(order)}</span>
        </div>
      </div>

      <RxTable od={od} os={os} />

      <div className="wc-opt-title">Optimized Power</div>
      <RxTable od={od} os={os} />
    </div>
  )
}

function LabelBarcode({ value }) {
  const svgRef = useRef(null)
  useEffect(() => {
    if (!svgRef.current || !value) return
    try {
      JsBarcode(svgRef.current, String(value), {
        format: 'CODE128',
        width: 1.2,
        height: 28,
        displayValue: true,
        fontSize: 10,
        margin: 0,
        textMargin: 1,
      })
    } catch {
      /* ignore invalid barcode payload */
    }
  }, [value])
  return <svg ref={svgRef} className="label-barcode" />
}

/**
 * Zebra 76×76 mm lab sticker — L/R box, lens, color/coating/ø, Rx grid, refs, barcode, LOT
 * @param {'L'|'R'} side
 */
export function LabelPreview({ order, side, eye, invoiceNo = '' }) {
  const e = eye || {}
  const size = e.size || '70'
  const colorLine = order.edging && order.edging !== 'None' ? order.edging : '—'
  const coatingLine = order.coating && order.coating !== 'None' ? order.coating : '—'
  const invoice = String(invoiceNo || '').trim()

  return (
    <div className="sticker zebra-label clex-label">
      <div className="cl-top">
        <div className="cl-side">{side}</div>
        <div className="cl-top-main">
          <div className="cl-lens">{stickerLensTitle(order)}</div>
          <div className="cl-meta-row">
            <div className="cl-meta-left">
              <div>
                <span className="cl-k">Color</span> {colorLine}
              </div>
              <div>
                <span className="cl-k">Coating</span> {coatingLine}
              </div>
            </div>
            <div className="cl-dia">ø{size}</div>
          </div>
        </div>
      </div>

      <table className="cl-rx">
        <thead>
          <tr>
            <th>Sphere</th>
            <th>Cylinder</th>
            <th>Axis</th>
            <th>Prism</th>
            <th>Base</th>
            <th>Addition</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>{eyeVal(e, 'sph', '0.00')}</td>
            <td>{eyeVal(e, 'cyl', '0.00')}</td>
            <td>{eyeVal(e, 'axis', '0')}</td>
            <td>{eyeVal(e, 'prism', '0.00')}</td>
            <td>{eyeVal(e, 'base', '0')}</td>
            <td>{eyeVal(e, 'add', '')}</td>
          </tr>
        </tbody>
      </table>

      <div className="cl-info">
        <div>
          <span className="cl-k">Reference:</span> {order.order_ref}
        </div>
        {invoice ? (
          <div>
            <span className="cl-k">Invoice:</span> {invoice}
          </div>
        ) : null}
        <div>
          <span className="cl-k">Customer No.:</span> —
        </div>
        <div>
          <span className="cl-k">Customer Name:</span> {order.customer_name}
        </div>
        <div>
          <span className="cl-k">Order No.:</span> {order.order_ref}
        </div>
      </div>

      <div className="cl-foot">
        <div className="cl-bar-wrap">
          <LabelBarcode value={order.order_ref} />
        </div>
        <div className="cl-lot">
          <div className="cl-lot-lbl">LOT</div>
          <div className="cl-lot-val">{formatLot(order.created_at)}</div>
        </div>
      </div>
    </div>
  )
}
