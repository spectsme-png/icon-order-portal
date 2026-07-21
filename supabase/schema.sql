-- ICON Order Portal — free Supabase schema
-- 1 optician (submit) + Aynai (receive + print; role value = office)

-- Run this in Supabase → SQL Editor → New query → Run

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  role text not null check (role in ('optician', 'office')),
  branch_name text default 'Main Branch',
  created_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_ref text not null,
  status text not null default 'NEW' check (status in ('NEW', 'RECEIVED', 'PRINTED', 'DONE', 'CANCELLED')),
  created_by uuid references auth.users(id),
  branch_name text,
  customer_name text not null,
  lens_type text,
  design text,
  func text,
  index_option text,
  coating text default 'None',
  edging text default 'None',
  tinting text default 'None',
  tint_color text,
  tint_pct text,
  specials text default 'None',
  remarks text,
  od jsonb not null default '{}'::jsonb,
  os jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_status_idx on public.orders (status);
create unique index if not exists orders_order_ref_uidx on public.orders (order_ref);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

-- Auto-create profile row is done manually in SETUP (assign role after signup)

alter table public.profiles enable row level security;
alter table public.orders enable row level security;

-- Helper: current user role
create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Profiles policies
drop policy if exists "profiles_select_own_or_office" on public.profiles;
create policy "profiles_select_own_or_office" on public.profiles
for select to authenticated
using (id = auth.uid() or public.current_role() = 'office');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

-- Orders: optician inserts + sees own; office sees all + updates
drop policy if exists "orders_insert_optician" on public.orders;
create policy "orders_insert_optician" on public.orders
for insert to authenticated
with check (
  public.current_role() = 'optician'
  and created_by = auth.uid()
);

drop policy if exists "orders_select_own_or_office" on public.orders;
create policy "orders_select_own_or_office" on public.orders
for select to authenticated
using (
  created_by = auth.uid()
  or public.current_role() = 'office'
);

drop policy if exists "orders_update_office" on public.orders;
create policy "orders_update_office" on public.orders
for update to authenticated
using (public.current_role() = 'office')
with check (public.current_role() = 'office');

-- Realtime (office live updates)
do $$
begin
  alter publication supabase_realtime add table public.orders;
exception
  when duplicate_object then null;
end $$;

