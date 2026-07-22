/** Special options with optional detail fields when checked. */
export const SPECIAL_DEFS = [
  {
    id: 'Custom Engraving',
    short: 'Engraving',
    type: 'text',
    maxLen: 8,
    lettersOnly: true,
    hintEn: '8 letters',
    hintAr: '8 أحرف',
  },
  {
    id: 'Decentration',
    short: 'Decentration',
    type: 'number',
    min: 1,
    max: 5,
    step: 1,
    unit: 'mm',
    hintEn: '1–5',
    hintAr: '1–5',
  },
  {
    id: 'Edge Blending',
    short: 'Edge Blend',
    type: 'flag',
    hintEn: '',
    hintAr: '',
  },
  {
    id: 'Special Base',
    short: 'Base',
    type: 'number',
    min: 0,
    max: 10,
    step: 0.25,
    unit: '',
    hintEn: '0–10',
    hintAr: '0–10',
  },
  {
    id: 'Special Dia',
    short: 'Dia',
    type: 'number',
    min: 50,
    max: 80,
    step: 1,
    unit: '',
    hintEn: '50–80',
    hintAr: '50–80',
  },
  {
    id: 'Special Thickness',
    short: 'Thickness',
    type: 'etct',
    min: 1,
    max: 5,
    step: 0.1,
    unit: 'mm',
    hintEn: 'ET/CT',
    hintAr: 'ET/CT',
  },
]

export function emptySpecialState() {
  const out = {}
  for (const d of SPECIAL_DEFS) {
    if (d.type === 'etct') out[d.id] = { on: false, et: '', ct: '' }
    else if (d.type === 'flag') out[d.id] = { on: false }
    else out[d.id] = { on: false, value: '' }
  }
  return out
}

function isOnStep(n, step) {
  if (!step) return true
  const scaled = n / step
  return Math.abs(scaled - Math.round(scaled)) < 1e-8
}

export function validateSpecials(specials, lang = 'en') {
  const errors = []
  for (const d of SPECIAL_DEFS) {
    const row = specials[d.id]
    if (!row?.on) continue

    if (d.type === 'flag') continue

    if (d.type === 'text') {
      const v = String(row.value || '').trim()
      if (!v) {
        errors.push(lang === 'ar' ? 'أدخل النقش المخصص' : 'Enter custom engraving text')
        continue
      }
      if (d.lettersOnly && !/^[A-Za-z]+$/.test(v)) {
        errors.push(lang === 'ar' ? 'النقش: أحرف إنجليزية فقط' : 'Engraving: English letters only')
      }
      if (v.length > d.maxLen) {
        errors.push(
          lang === 'ar'
            ? `النقش: حد أقصى ${d.maxLen} أحرف`
            : `Engraving: max ${d.maxLen} letters`,
        )
      }
      continue
    }

    if (d.type === 'number') {
      const raw = String(row.value ?? '').trim()
      if (!raw) {
        errors.push(
          lang === 'ar' ? `أدخل قيمة ${d.id}` : `Enter value for ${d.id}`,
        )
        continue
      }
      const n = Number(raw)
      if (!Number.isFinite(n) || n < d.min || n > d.max || !isOnStep(n, d.step)) {
        errors.push(
          lang === 'ar'
            ? `${d.id}: ${d.hintAr}`
            : `${d.id}: ${d.hintEn}`,
        )
      }
      continue
    }

    if (d.type === 'etct') {
      for (const key of ['et', 'ct']) {
        const raw = String(row[key] ?? '').trim()
        if (!raw) {
          errors.push(
            lang === 'ar'
              ? `سمك خاص: أدخل ${key.toUpperCase()} (1–5 مم)`
              : `Special Thickness: enter ${key.toUpperCase()} (1–5 mm)`,
          )
          continue
        }
        const n = Number(raw)
        if (!Number.isFinite(n) || n < d.min || n > d.max) {
          errors.push(
            lang === 'ar'
              ? `سمك خاص ${key.toUpperCase()}: 1–5 مم`
              : `Special Thickness ${key.toUpperCase()}: 1–5 mm`,
          )
        }
      }
    }
  }
  return errors
}

/** Compact string stored on the order (English labels for office/print). */
export function formatSpecials(specials) {
  const parts = []
  for (const d of SPECIAL_DEFS) {
    const row = specials[d.id]
    if (!row?.on) continue
    if (d.type === 'flag') {
      parts.push(d.id)
    } else if (d.type === 'etct') {
      parts.push(`${d.id}: ET ${row.et}mm / CT ${row.ct}mm`)
    } else if (d.type === 'text') {
      parts.push(`${d.id}: ${String(row.value || '').trim()}`)
    } else {
      const unit = d.unit ? ` ${d.unit}` : ''
      parts.push(`${d.id}: ${String(row.value || '').trim()}${unit}`)
    }
  }
  return parts.length ? parts.join(', ') : 'None'
}
