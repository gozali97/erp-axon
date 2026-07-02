# Rencana Membangun ERP Lengkap

Scope Anda (dari PRD sebelumnya) mencakup ~50 modul di 18 section. Ini tidak bisa dibangun sekaligus — akan makan puluhan iterasi. Yang saya usulkan adalah **jalur bertahap** yang setiap fasenya menghasilkan sesuatu yang bisa dipakai.

## Yang sudah ada
- ✅ Landing page marketing (Axon) — hero, modules grid, comparison SAP/Odoo, verticals, pricing CTA.

## Fase 1 — Fondasi (Cloud + Auth + Tenancy)
**Target: shell aplikasi yang bisa login dan punya konsep multi-company.**

1. Aktifkan Lovable Cloud (database + auth).
2. Halaman `/auth` (email+password, opsi Google).
3. Layout `_authenticated` untuk semua halaman admin.
4. Skema dasar:
   - `companies`, `branches`, `warehouses`
   - `profiles` (mirror `auth.users`)
   - `app_role` enum + `user_roles` + `has_role()` security-definer function
   - `user_warehouse_access`
5. Trigger auto-provisioning: user pertama daftar → dibuatkan Company + Branch + Warehouse default + role `owner`.
6. Layout admin dengan sidebar shadcn: Dashboard, Master Data, Inventory, Settings (menu lain di-disable/coming soon).
7. Company switcher di header (untuk user dengan akses ke banyak company).

## Fase 2 — Master Data & Inventory (Modul 3 dari PRD)
**Target: bisa kelola produk dan stok end-to-end.**

- Products, Categories (tree), Units + conversions
- Product detail dengan tabs (General, Pricing, Inventory, Barcodes)
- Batch/Serial/Expiry tracking (opsional per produk)
- `inventory_items` + `stock_movements` (ledger immutable) + `stock_cost_layers`
- RPC transaksional: `post_stock_movement`, `create_stock_transfer`
- Halaman: Stock Overview, Movement Ledger, Stock Adjustment, Stock Transfer, Stock Opname
- Reorder point alerts + Low Stock panel
- Aturan bisnis: no negative stock, valuation locked after first movement, FIFO/LIFO/Average

## Fase 3 — Procure-to-Pay (Purchasing)
Suppliers, Purchase Request → Purchase Order → Goods Receipt (auto-create stock movement) → Vendor Bill. Approval workflow.

## Fase 4 — Order-to-Cash (Sales)
Customers, Quotation → Sales Order (dengan stock reservation) → Delivery Order → Invoice → Payment.

## Fase 5 — Accounting Core
Chart of Accounts (template per industri), Journal Entries, auto-posting dari Sales/Purchase/Inventory, Trial Balance, P&L, Balance Sheet.

## Fase 6+ — Modul Lanjutan (per prioritas Anda)
Manufacturing (BOM/MRP) · HR/Payroll · POS · CRM · Projects · Helpdesk · Reporting/BI · Notifications · Audit Log · CMS (untuk landing/blog jika perlu diedit dari admin).

## Catatan Teknis
- Setiap tabel `public.*` selalu diikuti `GRANT` + RLS + policies scoped `company_id` lewat `has_role()`.
- Server logic pakai `createServerFn` + `requireSupabaseAuth` (bukan Edge Functions).
- Frontend: shadcn/ui + TanStack Query + TanStack Router (bukan FlyonUI, karena project sudah pakai shadcn).
- Angka disimpan `numeric(18,4)` untuk quantity & cost.
- Landing page tetap di `/`, admin di `/app` atau `/dashboard` di bawah `_authenticated`.

## Pertanyaan sebelum mulai

1. **CMS**: apakah CMS yang Anda maksud untuk mengedit **konten landing page** (blog, halaman marketing) dari admin? Atau CMS yang berbeda?
2. **Metode login**: cukup email/password + Google, atau perlu SSO/SAML dari awal?
3. **Bahasa UI**: Bahasa Indonesia, English, atau dua-duanya (i18n)?
4. **Currency default**: IDR atau USD?
5. **Setelah Fase 1 selesai**, apakah lanjut Inventory (Fase 2) sesuai urutan PRD Anda, atau ada modul lain yang lebih prioritas?

## Yang akan saya kerjakan di turn berikutnya (setelah Anda approve)
**Hanya Fase 1** — Cloud on, auth, tenancy schema, admin layout dengan sidebar. Fase 2+ menyusul setelah Fase 1 stabil.

Balas "lanjut" untuk mulai Fase 1, atau jawab pertanyaan di atas dulu.
