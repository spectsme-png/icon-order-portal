import { useEffect } from 'react'

/**
 * Sets @page size for browser print (Zebra 76×76 / Zenius CR-80).
 * Without this, Chrome defaults to A4 in the preview.
 */
export function usePrintPageSize(sizeCss) {
  useEffect(() => {
    const style = document.createElement('style')
    style.setAttribute('data-print-page-size', '1')
    style.textContent = `
      @page {
        size: ${sizeCss};
        margin: 0;
      }
      @media print {
        html, body {
          width: ${sizeCss.includes(' ') ? sizeCss.split(/\s+/)[0] : sizeCss};
          margin: 0 !important;
          padding: 0 !important;
          background: #fff !important;
        }
      }
    `
    document.head.appendChild(style)
    document.body.classList.add('print-exact-size')
    return () => {
      style.remove()
      document.body.classList.remove('print-exact-size')
    }
  }, [sizeCss])
}

export const LABEL_PAGE = '76mm 76mm'
export const CARD_PAGE = '85.6mm 53.98mm'
