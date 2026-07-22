-- Optional: dedicated invoice column (app also works via remarks marker)
-- Supabase → SQL Editor → Run

alter table public.orders
  add column if not exists invoice_no text;
