# Modern Modular ERP — Product Requirement Document (PRD)

**Status:** In progress — built in phases, each phase at full implementation depth.
**Last updated:** Phase 5 (Manufacturing) — COMPLETE

This PRD is split into linked documents instead of one monolithic file, so every
module gets genuine implementation-level detail (workflows, business rules,
validation, permissions, API contracts, UI specs) rather than shallow bullet points.

---

## Tech Stack (applies to all modules)

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite, TanStack Router/Query/Table/Form, Zustand, Axios |
| Backend | Laravel 12, REST API, Queue, Scheduler, JWT Auth |
| DB (dev) | SQLite |
| DB (prod) | MySQL 8 |
| UI | Tailwind CSS v4, FlyonUI, Heroicons, Dark Mode, WCAG 2.1 AA |
| Architecture | Modular, Feature-based folders, API-first, Offline-ready, Multi-Company/Branch/Warehouse |

Cross-cutting standards (naming, response envelope, error codes, RBAC model,
soft-delete convention, audit trail convention, multi-tenancy strategy) are
defined once in `03-database-design-core.md` and `04-module-authentication.md`,
and every later module document must conform to them rather than re-defining
its own.

---

## Document Index

### Phase 1 — Foundations ✅ COMPLETE

| # | Document | Contents |
|---|---|---|
| 01 | `01-executive-summary.md` | Business problems, goals, KPIs, scope, out-of-scope, risks, assumptions |
| 02 | `02-user-roles-permissions.md` | All 16 roles: responsibilities, menu access, approval authority, limits, permission matrix |
| 03 | `03-database-design-core.md` | Core ERD (tenancy, identity, RBAC, product, inventory skeleton), conventions, indexing strategy |
| 04 | `04-module-authentication.md` | Auth & session module — full spec |
| 05 | `05-module-company-branch-warehouse.md` | Company, Branch, Warehouse — full spec |
| 06 | `06-module-inventory-stock.md` | Product, Product Category, Unit, Inventory, Stock Movement — full spec |

### Phase 2 — Procure-to-Pay ✅ COMPLETE

| # | Document | Contents |
|---|---|---|
| 07 | `07-module-supplier.md` | Supplier master data — full spec |
| 08 | `08-module-purchase-request-order.md` | Purchase Request & Purchase Order — full spec |
| 09 | `09-module-goods-receipt-purchase-return.md` | Goods Receipt & Purchase Return — full spec |
| 10 | `10-module-accounting-core.md` | Chart of Accounts, General Ledger, Journal — full spec |
| 11 | `11-module-payment-ap.md` | Supplier Bill & Payment (Accounts Payable) — full spec |
| 12 | `12-workflow-procure-to-pay.md` | End-to-end Procure-to-Pay flowchart tying 07–11 together, control-point summary |

### Phase 3 — Order-to-Cash ✅ COMPLETE

| # | Document | Contents |
|---|---|---|
| 13 | `13-module-customer.md` | Customer master data — full spec |
| 14 | `14-module-sales-quotation-order.md` | Sales Quotation & Sales Order — full spec |
| 15 | `15-module-delivery-order.md` | Delivery Order — full spec |
| 16 | `16-module-invoice-payment-ar.md` | Invoice & Payment (Accounts Receivable) — full spec |
| 17 | `17-module-pos.md` | Point of Sale — full spec |
| 18 | `18-workflow-lead-to-cash.md` | End-to-end Lead-to-Cash flowchart tying 13–17 together (+ POS fast-path), control-point summary |

### Phase 4 — Finance Depth ✅ COMPLETE

| # | Document | Contents |
|---|---|---|
| 19 | `19-module-cashflow-bank-reconciliation.md` | Cash Flow & Bank Reconciliation — full spec |
| 20 | `20-module-budget.md` | Budget — full spec |
| 21 | `21-module-fixed-assets-depreciation.md` | Fixed Assets & Depreciation — full spec |
| 22 | `22-module-financial-reports.md` | Profit & Loss, Balance Sheet, Tax Summary, reporting engine pattern — full spec |

### Phase 5 — Manufacturing ✅ COMPLETE

| # | Document | Contents |
|---|---|---|
| 23 | `23-module-bom-production-order.md` | Bill of Materials & Production Order — full spec |
| 24 | `24-module-mrp.md` | Material Requirements Planning — full spec |
| 25 | `25-module-quality-control.md` | Quality Control — full spec |
| 26 | `26-module-maintenance.md` | Maintenance — full spec |
| 27 | `27-workflow-manufacturing.md` | End-to-end Manufacturing flowchart tying 23–26 together, control-point summary |

### Phase 6 — HR & People (next)
Employee, Attendance, Leave, Payroll, Recruitment, Performance.

### Phase 7 — Work Management
Projects, Tasks, Calendar, CRM, Helpdesk.

### Phase 8 — Platform Layer
Dashboards (per-role), Reports & Analytics engine, Notification Center, Audit Logs, Settings, Security hardening (Section 14), NFRs (Section 15), Folder Structure (Section 16), Roadmap (Section 17), Future AI Features (Section 18).

Each phase will be delivered as new files in this same `/prd` folder, and this
README will be updated to link them. Say "lanjut" (continue) at any point to
get the next phase, or name a specific module to jump ahead.

---

## Global Conventions (binding for every module going forward)

1. **Multi-tenancy:** every business table carries `company_id` (nullable=false). Branch- and warehouse-scoped tables additionally carry `branch_id` / `warehouse_id`.
2. **Primary keys:** unsigned BIGINT auto-increment `id`, plus a public-safe `uuid` column for API exposure where records may be shared externally (e.g. customer portal, webhooks).
3. **Soft deletes:** all master data and transactional headers use `deleted_at`; hard delete is never exposed via API, only through a scheduled purge job with audit trail.
4. **Audit columns:** `created_by`, `updated_by`, `created_at`, `updated_at` on every table; transactional tables also get `approved_by`, `approved_at`.
5. **Status fields:** stored as string enums validated at the application layer (not DB enum type, to stay portable between SQLite/MySQL), always paired with a `*_status_history` table for workflow tables.
6. **Numbering:** all transactional documents (PO, SO, Invoice, etc.) use a configurable per-company, per-branch document numbering sequence (`document_number_sequences` table), format e.g. `PO-YK-2026-000123`.
7. **API response envelope:**
```json
{
  "success": true,
  "data": { },
  "meta": { "pagination": {} },
  "errors": null
}
```
8. **Error format:**
```json
{
  "success": false,
  "data": null,
  "errors": [
    { "field": "email", "code": "EMAIL_TAKEN", "message": "Email is already registered." }
  ]
}
```
9. **Pagination:** cursor or page-based via TanStack Table server-side model; default page size 25, max 100.
10. **Permissions:** every API route is guarded by a `module.action` permission string (e.g. `inventory.stock.adjust`), checked against the role's permission matrix defined in `02-user-roles-permissions.md`.
