# ICON Order Portal — Free setup (1 Optician + Aynai)

Online order system under the **ICON** brand:
- **Optician** uses **ICON Order Portal for Optician** — fill & send orders (no printing)
- **Aynai** receives orders, prints stickers & warranty, chooses printer in browser

**Free stack:** Supabase (database + login + backup) + this website

Project folder: `C:\Users\WinDows\Desktop\eyeglass-lab-portal`

---

## Step 1 — Create free Supabase project

1. Open https://supabase.com → **Start your project** (GitHub login is fine)
2. Create organization → **New project**
3. Name: `icon-order-portal`
4. Set a strong database password (save it)
5. Region: choose closest to you
6. Wait until project is ready

## Step 2 — Create database tables

1. In Supabase left menu: **SQL** → **New query**
2. Open file: `supabase/schema.sql` from this project
3. Copy all SQL → paste into editor → **Run**
4. Confirm success (no red errors)

## Step 3 — Create the 2 users

1. Supabase → **Authentication** → **Users** → **Add user** → **Create new user**
2. Create **Aynai** user (receives orders):
   - Email: e.g. `aynai@yourdomain.com`
   - Password: choose one
   - Auto Confirm User: **ON**
3. Create **Optician** user:
   - Email: e.g. `optician@yourdomain.com`
   - Password: choose one
   - Auto Confirm User: **ON**

## Step 4 — Assign roles (important)

1. Supabase → **Authentication** → **Users**
2. Click each user → copy their **UUID**
3. SQL Editor → run (replace UUIDs and emails):

```sql
insert into public.profiles (id, email, full_name, role, branch_name)
values
  ('AYNAI-USER-UUID', 'aynai@yourdomain.com', 'Aynai', 'office', 'Aynai Lab'),
  ('OPTICIAN-USER-UUID', 'optician@yourdomain.com', 'Optician', 'optician', 'Shop 1')
on conflict (id) do update
set role = excluded.role,
    email = excluded.email,
    full_name = excluded.full_name,
    branch_name = excluded.branch_name;
```

Note: in the database, Aynai’s role value is still `office` (receive/print side).

## Step 5 — Get API keys

1. Supabase → **Project Settings** → **API**
2. Copy:
   - **Project URL**
   - **anon public** key

## Step 6 — Configure this app locally

In `eyeglass-lab-portal` folder:

1. Copy `.env.example` to `.env`
2. Paste your values:

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

3. In terminal:

```powershell
cd C:\Users\WinDows\Desktop\eyeglass-lab-portal
npm install
npm run dev
```

4. Open the local URL shown (usually http://localhost:5173)

## Step 7 — Test flow

1. Login as **optician** → fill order → **Send order to Aynai**
2. Login as **Aynai** (other browser/incognito) → see order appear
3. Click **Print stickers** or **Print warranty**
4. In print dialog: choose your sticker/card printer (or Microsoft Print to PDF to test)

## Online backup

All orders are stored in Supabase Postgres (cloud).  
You can export anytime: **Table Editor → orders → Export**.

## Step 8 — Put website online (free) — when ready

1. Push this folder to a free GitHub repo
2. Go to https://vercel.com → Import repo → Framework: Vite
3. Add the same 2 env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
4. Deploy → share the URL with optician and Aynai

---

## Roles summary

| Account | UI name | Can do |
|--------|---------|--------|
| Optician | ICON Order Portal for Optician | Create/send orders |
| Aynai | ICON · Aynai | Receive all orders, print stickers/warranty |

No printing on optician side.
