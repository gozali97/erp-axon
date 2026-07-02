# Axon — Modular ERP (Business Flow Suite)

Axon adalah ERP modular API-first untuk mid-market & multi-entity. Konsolidasikan
Sales, Inventory, Accounting, Manufacturing, dan HR dalam satu platform.

> **Catatan:** Project ini terhubung ke [Lovable](https://lovable.dev). Hindari
> rewrite published git history (force-push / rebase / squash commit yang sudah
> di-push) agar history di sisi Lovable tidak hilang.

---

## Tech Stack

| Lapisan | Teknologi |
| --- | --- |
| Framework | TanStack Start (SSR via Nitro/h3) + Vite 8 |
| Routing | TanStack Router (file-based) |
| State / Server-cache | TanStack React Query |
| UI | React 19, Tailwind CSS v4, Radix UI (shadcn-style), lucide-react, recharts |
| Forms | react-hook-form + zod |
| Database | **SQLite** via [sql.js](https://github.com/sql-js/sql.js) (WASM) — berjalan di browser, di-persist ke IndexedDB |
| Auth | Local email/password (PBKDF2 via WebCrypto, session di localStorage) |

---

## Database & Persistensi

Database menggunakan **SQLite yang berjalan client-side** (di browser via
sql.js/WASM). Data disimpan ke **IndexedDB** sehingga tetap ada setelah refresh
atau tutup browser — tidak hilang.

```
src/lib/db/
├── engine.ts          # inisialisasi sql.js + persistensi IndexedDB (debounced save)
├── schema.ts          # 40 tabel + 23 enum (sebagai CHECK constraint)
├── relations.ts       # registry FK untuk PostgREST-style join embedding
├── query-builder.ts   # compat layer: supabase.from() (select/eq/or/order/insert/...)
├── rpc.ts             # 18 fungsi Postgres RPC direimplementasi di TypeScript
├── auth.ts            # autentikasi lokal (PBKDF2 + session)
├── helpers.ts         # UUID, doc numbering, stock movement poster, journal poster
└── seed.ts            # seed dummy superadmin + demo company
```

### Compat Layer

Aplikasi memakai API yang sama dengan Supabase (`supabase.from()`, `supabase.rpc()`,
`supabase.auth.*`) — di-backed oleh SQLite. Artinya 25 file route tidak perlu
diubah. Saat ingin migrasi ke server-side nanti, cukup ganti implementasi di balik
interface yang sama.

Endpoint compat (`src/integrations/supabase/client.ts`):

```ts
supabase.from("products").select("*, units(code)").eq("company_id", id);
supabase.rpc("create_purchase_order", { _company_id, _lines, ... });
supabase.auth.signInWithPassword({ email, password });
```

### Akun Dummy Superadmin

Saat pertama kali load, database otomatis di-seed dengan akun superadmin dan
demo company lengkap (produk, supplier, customer, employee, BOM, stok awal,
chart of accounts, CMS content):

| Field | Nilai |
| --- | --- |
| Email | `admin@axon.test` |
| Password | `admin123` |
| Role | `owner` (akses penuh semua modul) |
| Company | PT Axon Demo Sejahtera |

Reset database: hapus data IndexedDB key `axon-erp-sqlite` lewat DevTools
(Application → IndexedDB) lalu refresh.

---

## Cara Menjalankan

Prasyarat: [Bun](https://bun.sh) (atau Node 20+).

```bash
# install dependencies
bun install

# jalankan dev server (default http://localhost:8080)
bun run dev

# build production
bun run build

# preview hasil build
bun run preview

# lint & format
bun run lint
bun run format
```

Tidak perlu konfigurasi `.env` Supabase lagi — database berjalan sepenuhnya
lokal di browser.

---

## Struktur Proyek

```
src/
├── router.tsx              # createRouter + QueryClient context
├── start.ts                # createStart middleware (error handler + auth attacher no-op)
├── server.ts               # Nitro/h3 fetch handler + SSR error normalization
├── styles.css              # Tailwind theme
├── routes/
│   ├── __root.tsx          # root layout (QueryClientProvider, head meta, 404/error)
│   ├── index.tsx           # landing page publik (hero, modul, vertikal, pricing)
│   ├── auth.tsx            # login / signup (email + password)
│   ├── blog.*              # blog (CMS-driven)
│   └── _authenticated/     # auth-gated (ssr:false)
│       ├── route.tsx       # beforeLoad gate (supabase.auth.getUser)
│       ├── app.tsx         # app shell: sidebar + CompanySwitcher + UserMenu
│       ├── app.index.tsx   # dashboard summary
│       └── app.{module}.*   # 12 modul bisnis (lihat bawah)
├── components/ui/          # komponen UI (Radix/shadcn)
├── hooks/                  # use-active-company, use-mobile
├── integrations/
│   ├── supabase/           # client.ts (compat), auth-attacher, auth-middleware, types
│   └── lovable/            # stub OAuth (no-op, email/password saja)
└── lib/
    ├── db/                 # engine SQLite + schema + query builder + rpc + auth + seed
    ├── error-capture.ts
    ├── error-page.ts
    ├── lovable-error-reporting.ts
    └── utils.ts
```

---

## Modul Bisnis

12 modul aktif di sidebar (`/_authenticated/app.*`):

| Modul | Route | Deskripsi |
| --- | --- | --- |
| Dashboard | `/app` | Ringkasan company/branch/warehouse/team |
| Products | `/app/products` | Master produk + unit + kategori |
| Categories | `/app/categories` | Kategori produk (tree) |
| Units | `/app/units` | Satuan & konversi |
| Inventory | `/app/inventory` (+movements, opname) | Stok, pergerakan, stock opname (FIFO/LIFO/Average) |
| Purchasing | `/app/purchasing` (+orders/$poId, suppliers) | Procure-to-Pay: PR → PO → GR |
| Sales | `/app/sales` (+orders/$soId, invoices, customers) | Order-to-Cash: SO → DO → Invoice |
| POS | `/app/pos` (+history) | Point of Sale (cash/card/transfer/qris) |
| Manufacturing | `/app/manufacturing` (bom, mrp, wo) | BOM, MRP, Work Order |
| CRM | `/app/crm` (leads, opportunities, activities) | Lead → Customer, pipeline |
| Accounting | `/app/accounting` (journals, reports) | Chart of Accounts, jurnal, trial balance |
| HR | `/app/hr` (employees, departments, attendance, leave, payroll) | Karyawan, absensi, cuti, payroll |
| CMS | `/app/cms` (posts + landing content) | Konten landing & blog |

### Auto-posting Accounting

Operasi transaksional otomatis membuat journal entries (double-entry):

- **Goods Receipt** → Dr Persediaan / Cr Utang Usaha
- **Delivery Order** → Dr HPP / Cr Persediaan
- **Customer Invoice** → Dr Piutang / Cr Penjualan (+ Cr PPN Keluaran)
- **POS Payment** → Dr Kas / Cr Piutang
- **Payroll Post** → Dr Beban Gaji / Cr Kas (+ Cr Utang PPh 21)

### Multi-entity

Tenant = **company**. Hierarki `companies → branches → warehouses`. Setiap tabel
transaksional membawa `company_id`. User dapat bergabung di multiple company
via `user_roles`, dan beralih perusahaan aktif lewat CompanySwitcher di header.

---

## Flow Aplikasi

```
Landing(/) ──sign in──▶ /auth ──▶ auth (PBKDF2) ──▶ /_authenticated (beforeLoad gate)
                                                       │
                                  ┌────────────────────┴─── app.tsx (sidebar + company switcher)
                                  ▼
   Dashboard ─▶ Master ─▶ Inventory ─▶ P2P ─▶ O2C ─▶ MFG ─▶ Accounting ─▶ HR ─▶ CRM ─▶ CMS
        semua query SQLite (company_id scope) + React Query cache + IndexedDB persist
```

---

## Scripts

| Perintah | Fungsi |
| --- | --- |
| `bun run dev` | Dev server dengan HMR |
| `bun run build` | Build production (Nitro/Cloudflare) |
| `bun run build:dev` | Build mode development |
| `bun run preview` | Preview hasil build |
| `bun run lint` | ESLint |
| `bun run format` | Prettier format |

---

## Lisensi

© 2026 Axon Systems. Engineered for the mid-market.
