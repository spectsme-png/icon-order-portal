/**
 * ICON local print agent — run on the office PC only.
 *   cd print-agent
 *   npm install
 *   npm start
 *
 * Listens on http://127.0.0.1:9100
 * Browser portal sends PDFs here for silent print (no dialog).
 */

import cors from 'cors'
import express from 'express'
import fs from 'fs'
import os from 'os'
import path from 'path'
import pkg from 'pdf-to-printer'
const { getPrinters, print } = pkg

const PORT = Number(process.env.PRINT_AGENT_PORT || 9100)
const app = express()

app.use(cors({ origin: true }))
app.use(express.json({ limit: '25mb' }))

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'icon-print-agent', port: PORT })
})

app.get('/printers', async (_req, res) => {
  try {
    const printers = await getPrinters()
    res.json({
      printers: printers.map((p) => ({
        name: p.name,
        isDefault: Boolean(p.isDefault),
      })),
    })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to list printers' })
  }
})

app.post('/print', async (req, res) => {
  const { printer, pdfBase64, jobName } = req.body || {}
  if (!printer || typeof printer !== 'string') {
    return res.status(400).json({ error: 'printer name required' })
  }
  if (!pdfBase64 || typeof pdfBase64 !== 'string') {
    return res.status(400).json({ error: 'pdfBase64 required' })
  }

  const raw = pdfBase64.replace(/^data:application\/pdf;base64,/, '')
  const tmp = path.join(
    os.tmpdir(),
    `icon-print-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`,
  )

  try {
    fs.writeFileSync(tmp, Buffer.from(raw, 'base64'))
    await print(tmp, {
      printer,
      silent: true,
      scale: 'noscale',
      monochrome: false,
    })
    res.json({ ok: true, printer, jobName: jobName || 'ICON print' })
  } catch (err) {
    res.status(500).json({ error: err.message || 'Print failed' })
  } finally {
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* ignore */
    }
  }
})

app.listen(PORT, '127.0.0.1', () => {
  console.log(`ICON print agent ready on http://127.0.0.1:${PORT}`)
  console.log('Keep this window open while using the office portal.')
})
