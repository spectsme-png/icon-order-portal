import { createClient } from '@supabase/supabase-js'

const DEFAULT_URL = 'https://tznjindsxwhrujkuapjw.supabase.co'
const DEFAULT_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6bmppbmRzeHdocnVqa3VhcGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NDQyODIsImV4cCI6MjEwMDIyMDI4Mn0.zmermuC_932xp8cHFpKVhd-XO8JgpONUDrnj7ZfR1Lo'

const envUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const envAnon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

function looksLikeJwt(value) {
  return /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
}

const url =
  envUrl && envUrl.includes('supabase.co') && !envUrl.includes('YOUR_PROJECT')
    ? envUrl
    : DEFAULT_URL

const anon = looksLikeJwt(envAnon) ? envAnon : DEFAULT_ANON

if (!looksLikeJwt(envAnon) && envAnon) {
  console.warn(
    'VITE_SUPABASE_ANON_KEY is invalid (must be the JWT starting with eyJ…). Using built-in key.',
  )
}

/** Kept for compatibility; never block the login screen. */
export const supabaseConfigError = null

export const supabase = createClient(url, anon)
