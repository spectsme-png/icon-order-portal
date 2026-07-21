import { createClient } from '@supabase/supabase-js'

const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const anon = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

function looksLikeJwt(value) {
  return /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)
}

export const supabaseConfigError = (() => {
  if (!url || url.includes('YOUR_PROJECT') || !url.includes('supabase.co')) {
    return 'VITE_SUPABASE_URL is missing or invalid in Vercel Environment Variables.'
  }
  if (!anon || anon.includes('YOUR_ANON') || anon.toLowerCase().includes('.env') || !looksLikeJwt(anon)) {
    return 'VITE_SUPABASE_ANON_KEY is wrong. In Vercel it must be the long key starting with eyJ… (not a file path).'
  }
  return null
})()

if (supabaseConfigError) {
  console.error(supabaseConfigError, { url, anonPreview: anon.slice(0, 12) })
}

export const supabase = createClient(
  looksLikeJwt(anon) ? url : 'https://tznjindsxwhrujkuapjw.supabase.co',
  looksLikeJwt(anon) ? anon : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6bmppbmRzeHdocnVqa3VhcGp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NDQyODIsImV4cCI6MjEwMDIyMDI4Mn0.zmermuC_932xp8cHFpKVhd-XO8JgpONUDrnj7ZfR1Lo',
)
