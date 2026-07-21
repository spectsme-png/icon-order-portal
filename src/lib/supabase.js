import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon || String(url).includes('YOUR_PROJECT') || String(anon).includes('YOUR_ANON')) {
  console.error('Supabase env missing. Check .env has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, then restart npm run dev.')
}

export const supabase = createClient(
  url || 'https://tznjindsxwhrujkuapjw.supabase.co',
  anon || 'missing-key',
)
