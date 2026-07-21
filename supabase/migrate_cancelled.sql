-- Fix: allow CANCELLED status on orders
-- Supabase → SQL Editor → paste all → Run

do $$
declare
  cname text;
begin
  select con.conname into cname
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'orders'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%status%';
  limit 1;

  if cname is not null then
    execute format('alter table public.orders drop constraint %I', cname);
  end if;
end $$;

alter table public.orders
  add constraint orders_status_check
  check (status in ('NEW', 'RECEIVED', 'PRINTED', 'DONE', 'CANCELLED'));
