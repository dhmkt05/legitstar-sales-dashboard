# Legitstar Sales Dashboard

Live sales performance dashboard — standalone Next.js app connected to Supabase.

## Stack
- Next.js 14 (App Router)
- Supabase (same project as main app — read-only via service role)
- Vercel (separate deployment)

---

## Deploy in 5 steps

### Step 1 — Supabase: run the migration SQL
Go to **Supabase Dashboard → SQL Editor** and run the `migration.sql` file.
This creates the `execute_sql` RPC that the dashboard uses to run analytics queries.

### Step 2 — Clone and push to GitHub
```bash
# Create a new private GitHub repo called "legitstar-sales-dashboard"
# Then run:
cd legitstar-sales-dashboard
git init
git add .
git commit -m "Initial sales dashboard"
git remote add origin https://github.com/YOUR_USERNAME/legitstar-sales-dashboard.git
git push -u origin main
```

### Step 3 — Create a new Vercel project
1. Go to https://vercel.com/new
2. Import the GitHub repo you just pushed
3. Framework: **Next.js** (auto-detected)
4. Click **Deploy** — it will fail on first try because env vars aren't set yet

### Step 4 — Add environment variables in Vercel
Go to **Vercel → Your Project → Settings → Environment Variables** and add:

| Name | Value | Environments |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://objqmpadfwoaznlrdxel.supabase.co` | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` (from Supabase → Settings → API) | Production, Preview, Development |
| `DASHBOARD_PASSWORD` | Any password you choose | Production only |

⚠️ **NEVER** add `NEXT_PUBLIC_` prefix to `SUPABASE_SERVICE_ROLE_KEY`.
⚠️ Get your service role key from: Supabase → Settings → API → `service_role` (secret key).

### Step 5 — Redeploy
Go to **Vercel → Deployments → Redeploy** after adding env vars.
Your dashboard will be live at `https://legitstar-sales-dashboard.vercel.app`

---

## Local development

```bash
# 1. Copy the env template
cp .env.example .env.local

# 2. Fill in .env.local with your real Supabase values
# (never commit .env.local — it's gitignored)

# 3. Install and run
npm install
npm run dev
# → Open http://localhost:3001
```

---

## Optional: Custom domain
In Vercel → Settings → Domains, add something like:
`sales.legitstar.sg` or `dashboard.legitstar.sg`

Then add a CNAME record in Namecheap:
- Host: `sales`
- Value: `cname.vercel-dns.com`

---

## Security notes
- Dashboard is protected by HTTP Basic Auth (set `DASHBOARD_PASSWORD` in Vercel)
- `SUPABASE_SERVICE_ROLE_KEY` is server-side only — never exposed to the browser
- `execute_sql` RPC only allows `SELECT` and `WITH` queries — writes are blocked
- RPC access is revoked from `anon` and `authenticated` roles
