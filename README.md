# Saral Retail Console

A real React app wired to a live Supabase backend (Postgres + Auth + row-level
security). Built as the working vertical slice: login, Dashboard, Goods &
Inventory, and Sales Voucher, all reading and writing real data.

## Run it locally

```
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173).

Demo logins (already seeded in the database):
- Owner (full access): `rina@demo1` / `Saral@123`
- Cashier (sales voucher only): `priya@demo1` / `Saral@123`

## Deploy

This is a static site (Vite build) that talks directly to Supabase — there is
no separate backend server to host.

```
npm run build
```

This produces a `dist/` folder you can deploy to GitHub Pages, Vercel,
Netlify, or any static host. For GitHub Pages specifically, remember to set
`base` in `vite.config.js` to your repo name if it's not deployed at the
domain root.

## What's already wired to the real database

- Login (`login_name@org_code` format, resolved to Supabase Auth under the hood)
- Dashboard (today's sales, low-stock alerts, recent vouchers — all live)
- Goods & Inventory (live stock levels computed from the append-only ledger)
- Sales Voucher (posts atomically to sales_vouchers + ledger_entries + stock_ledger)

Permissions are enforced by the database itself (row-level security), not
just hidden in the UI — a user without a module's permission cannot read or
write that data even if they call the API directly.
