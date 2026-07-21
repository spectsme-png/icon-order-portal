# Put ICON Order Portal online (free)

Your **orders + login** are already in Supabase cloud.  
You only need to host this website (Vite React app).

## Fastest way: Vercel (recommended)

### 1) Create a GitHub repo
1. Open https://github.com/new  
2. Name: `icon-order-portal` (Public or Private)  
3. **Do not** add README  
4. On your PC, in PowerShell:

```powershell
cd C:\Users\WinDows\Desktop\eyeglass-lab-portal
git init
git add .
git commit -m "ICON order portal ready for deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/icon-order-portal.git
git push -u origin main
```

(Replace `YOUR_USERNAME` with your GitHub username.)

### 2) Deploy on Vercel
1. Open https://vercel.com → Sign up with **GitHub**  
2. **Add New… → Project** → Import `icon-order-portal`  
3. Framework: **Vite** (auto)  
4. **Environment Variables** → add both:

| Name | Value |
|------|--------|
| `VITE_SUPABASE_URL` | `https://tznjindsxwhrujkuapjw.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | *(same anon key as in your local `.env`)* |

5. Click **Deploy**  
6. Copy your live URL, e.g. `https://icon-order-portal.vercel.app`

### 3) Allow login from the live URL (Supabase)
1. Supabase → **Authentication** → **URL Configuration**  
2. **Site URL** = your Vercel URL  
3. **Redirect URLs** add:
   - `https://YOUR-APP.vercel.app/**`
   - `http://localhost:5173/**` (keep for local testing)

### 4) Share with users
- Optician: `https://YOUR-APP.vercel.app/login` → `iconoptical@gmail.com`  
- Aynai: same URL → `spectsme@gmail.com`

Printing stays in the **browser** on Aynai’s PC (choose Zenius / Zebra in the print dialog).

---

## After deploy checklist
- [ ] Optician can log in and send an order  
- [ ] Aynai can log in and see it  
- [ ] Print card / labels open and print  

## Updates later
Change code locally → `git add .` → `git commit -m "..."` → `git push`  
Vercel redeploys automatically.
