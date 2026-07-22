import { createClient } from '@supabase/supabase-js'

const DEFAULT_URL = 'https://tznjindsxwhrujkuapjw.supabase.co'
const DEFAULT_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6bmppbmRzeHdocnVqa3VhcGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NDQyODIsImV4cCI6MjEwMDIyMDI4Mn0.zmermuC_932xp8cHFpKVhd-XO8JgpONUDrnj7ZfR1Lo'

function clean(value) {
  return String(value || '')
    .trim()
    .replace(/^["']|["']$/g, '')
}

function looksLikeJwt(value) {
  return /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
}

function looksLikeSupabaseUrl(value) {
  try {
    const u = new URL(value)
    return u.protocol === 'https:' && u.hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
}

const envUrl = clean(import.meta.env.VITE_SUPABASE_URL)
const envAnon = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)

const url = looksLikeSupabaseUrl(envUrl) ? envUrl : DEFAULT_URL
const anon = looksLikeJwt(envAnon) ? envAnon : DEFAULT_ANON

export const supabaseConfigError = null

export const supabase = createClient(url, anon)
