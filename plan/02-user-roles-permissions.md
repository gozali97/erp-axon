# 2. User Roles

Roles are **system-defined templates**; every company can clone a template into a
**custom role** and adjust its permission matrix (see `04-module-authentication.md`
for the Role/Permission data model). The 16 roles below ship as defaults.

Permission notation used throughout this PRD: `module.resource.action`
(e.g. `purchasing.po.approve`). Actions are one of:
`view`, `create`, `edit`, `delete`, `approve`, `reject`, `export`, `import`, `void`.

---

## 2.1 Super Admin

- **Description:** Platform-level operator (Anthropic-style "Anthropic staff" equivalent for this product — i.e. the SaaS vendor's own ops team), not scoped to any single company.
- **Responsibilities:** Manage tenant (company) provisioning, subscription/module entitlements, platform-wide monitoring, impersonation for support (with audit trail), global system settings.
- **Menu Access:** Platform Admin Console only (separate app shell from tenant ERP UI) — Tenants, Subscriptions, Module Entitlements, System Health, Global Audit Log.
- **Approval Authority:** None within tenant business processes; can force-unlock a stuck approval chain only via a logged "support override" action.
- **Limitations:** Cannot view tenant business data (customer PII, financials) by default — requires explicit, time-boxed, audit-logged impersonation grant from the Company Owner.
- **Permission scope:** `platform.*`

## 2.2 Company Owner

- **Description:** Top-level owner within a tenant; exists once conceptually but can be assigned to multiple users (e.g. co-founders).
- **Responsibilities:** Company setup, module enablement/disablement, branch/warehouse creation, user & role management, subscription/billing, final approval authority for high-value transactions and master-data changes (COA, tax rates).
- **Menu Access:** Full access to all enabled modules + Settings + User Management + Role Management + Audit Logs.
- **Approval Authority:** Highest — no monetary threshold ceiling; can override any lower approval.
- **Limitations:** Cannot access Platform Admin Console; cannot see other tenants.
- **Permission scope:** `*` within own `company_id` (all modules, all actions), minus platform-level.

## 2.3 Director

- **Description:** Senior executive below Owner; typically oversees one or more departments across branches.
- **Responsibilities:** Strategic oversight, high-level approvals (large POs, budget changes, hiring), cross-branch reporting.
- **Menu Access:** All Dashboards, all Reports, read access to all transactional modules, write access limited to approvals and Settings sub-areas explicitly delegated by Owner.
- **Approval Authority:** Configurable high threshold (e.g. POs > company-configured limit, budget revisions, employee terminations).
- **Limitations:** Cannot modify Chart of Accounts or delete companies/branches; cannot manage billing.
- **Permission scope:** `*.view`, `*.approve` (thresholded), `dashboard.*`, `reports.*`.

## 2.4 Finance

- **Description:** Oversees company-wide financial policy (broader than day-to-day bookkeeping, which is Accounting's role).
- **Responsibilities:** Budget approval, cash flow oversight, bank reconciliation sign-off, fixed asset approval, financial report review, payment approval.
- **Menu Access:** Accounting module (full), Budget, Cash Flow, Bank Reconciliation, Fixed Assets, Payment approvals, Financial Reports.
- **Approval Authority:** Payments above Accounting-clerk threshold, budget allocations, fixed asset capitalization/disposal.
- **Limitations:** Cannot manage HR/Payroll data; cannot change system-wide Settings outside Finance sub-module.
- **Permission scope:** `accounting.*`, `budget.*`, `cashflow.*`, `bank-reconciliation.*`, `fixed-assets.*`, `payment.approve`.

## 2.5 Accounting

- **Description:** Day-to-day bookkeeping staff.
- **Responsibilities:** Journal entry creation, invoice/bill posting, payment recording, bank statement import, GL maintenance, tax filing prep.
- **Menu Access:** Accounting (Journal, GL, Chart of Accounts read-only unless delegated), Invoice, Payment, Bank Reconciliation (data entry level).
- **Approval Authority:** None by default for postings above threshold; can post routine journal entries; needs Finance sign-off for reversals/adjustments above threshold.
- **Limitations:** Cannot approve own payment entries above threshold (segregation of duties enforced); cannot edit Chart of Accounts structure.
- **Permission scope:** `accounting.journal.*` (below threshold), `accounting.gl.view`, `invoice.*`, `payment.create`, `bank-reconciliation.create`.

## 2.6 HR

- **Description:** Human resources staff.
- **Responsibilities:** Employee records, attendance policy, leave approval (first level), recruitment pipeline, performance review coordination.
- **Menu Access:** HR module full (Employee, Attendance, Leave, Recruitment, Performance); Payroll read-only unless also granted Payroll role.
- **Approval Authority:** Leave requests (non-management staff), recruitment stage transitions.
- **Limitations:** Cannot process payroll runs unless explicitly granted; cannot access Accounting/Finance modules.
- **Permission scope:** `hr.employee.*`, `hr.attendance.*`, `hr.leave.*`, `hr.recruitment.*`, `hr.performance.*`, `payroll.view`.

## 2.7 Warehouse

- **Description:** Warehouse/inventory operations staff.
- **Responsibilities:** Stock receipt, stock movement, stock transfer between warehouses, stock count/opname, stock adjustment (with approval), goods receipt against PO.
- **Menu Access:** Inventory, Stock Movement, Goods Receipt, Warehouse settings (own warehouse only unless multi-warehouse role).
- **Approval Authority:** None for adjustments above threshold (requires Warehouse Manager/Owner approval); can confirm receipt quantities.
- **Limitations:** Scoped to assigned warehouse(s) only via `user_warehouse_scope` table; cannot see other warehouses' stock unless granted "all warehouses" flag.
- **Permission scope:** `inventory.*` (warehouse-scoped), `goods-receipt.*`, `stock-movement.*`, `purchase-return.create`.

## 2.8 Purchasing

- **Description:** Procurement staff.
- **Responsibilities:** Purchase requests, supplier selection/RFQ, purchase orders, purchase returns, supplier master data.
- **Menu Access:** Supplier, Purchase Request, Purchase Order, Purchase Return.
- **Approval Authority:** Purchase Requests below threshold auto-approved to PO stage; POs above threshold escalate to Director/Owner.
- **Limitations:** Cannot approve their own POs above any threshold (segregation of duties); cannot post Goods Receipt (Warehouse role does that) to preserve receipt-vs-order segregation.
- **Permission scope:** `supplier.*`, `purchase-request.*`, `purchase-order.*` (create/edit; approve only below threshold if delegated), `purchase-return.*`.

## 2.9 Sales

- **Description:** Sales staff / account managers.
- **Responsibilities:** Sales quotations, sales orders, customer master data (own accounts), delivery order initiation, CRM lead/opportunity management.
- **Menu Access:** Customer, Sales Quotation, Sales Order, Delivery Order (initiate), CRM.
- **Approval Authority:** Discounts within configured limit; quotations do not require approval, sales orders above discount/credit-limit threshold escalate to Sales Manager/Director.
- **Limitations:** Cannot modify pricing master (Product price lists) unless delegated; cannot approve credit limit overrides.
- **Permission scope:** `customer.*` (own accounts or team, configurable), `sales-quotation.*`, `sales-order.*`, `delivery-order.create`, `crm.*`.

## 2.10 Marketing

- **Description:** Marketing staff, primarily CRM-adjacent.
- **Responsibilities:** Campaign management, lead capture/import, customer segmentation, marketing-qualified-lead handoff to Sales.
- **Menu Access:** CRM (Campaigns, Leads), Customer (read + segment tagging), Reports (marketing).
- **Approval Authority:** None (operational role).
- **Limitations:** Cannot access Sales Order/Invoice/pricing data; read-only on Customer beyond segmentation fields.
- **Permission scope:** `crm.campaign.*`, `crm.lead.*`, `customer.view`, `customer.segment.edit`.

## 2.11 Production

- **Description:** Manufacturing floor supervisors/planners.
- **Responsibilities:** Production order execution, BOM reference, MRP run review, quality control checkpoints, maintenance requests.
- **Menu Access:** Manufacturing module (BOM read, Production Order full, MRP view, Quality Control, Maintenance).
- **Approval Authority:** Production order start/complete confirmation; QC pass/fail/hold decisions.
- **Limitations:** Cannot edit BOM structure (Engineering/Product-owner function, delegated per company); cannot approve MRP-driven POs directly — MRP output feeds Purchasing's queue.
- **Permission scope:** `manufacturing.production-order.*`, `manufacturing.bom.view`, `manufacturing.mrp.view`, `manufacturing.qc.*`, `manufacturing.maintenance.*`.

## 2.12 Customer Service

- **Description:** Post-sale support staff.
- **Responsibilities:** Helpdesk ticket handling, order status lookup, return/complaint intake, customer communication log.
- **Menu Access:** Helpdesk (full), Customer (read + activity log), Sales Order (read), Delivery Order (read).
- **Approval Authority:** Ticket resolution/closure; escalation to Sales/Warehouse for return processing (does not itself approve returns).
- **Limitations:** No pricing, invoicing, or inventory-adjustment permissions.
- **Permission scope:** `helpdesk.*`, `customer.view`, `sales-order.view`, `delivery-order.view`.

## 2.13 Cashier

- **Description:** Point-of-sale operator.
- **Responsibilities:** POS transactions, cash drawer open/close, shift reconciliation, on-the-spot returns within POS policy.
- **Menu Access:** POS module only (locked kiosk-style UI), own shift's transaction history.
- **Approval Authority:** None beyond configured discount ceiling at POS; refunds above threshold require Supervisor PIN override.
- **Limitations:** Cannot access back-office modules at all; session scoped to a single POS terminal/register and shift.
- **Permission scope:** `pos.transaction.*` (shift-scoped), `pos.shift.*`.

## 2.14 Guest

- **Description:** Minimal-access external or trial user (e.g. auditor-in-training, vendor self-service portal placeholder, demo account).
- **Responsibilities:** View-only access to explicitly shared records (e.g. a specific quotation shared with a prospect, a specific PO shared with a supplier).
- **Menu Access:** No standard menu — access is via direct shareable links/portal views only.
- **Approval Authority:** None.
- **Limitations:** No list/browse access to any module; cannot see anything not explicitly shared with them; sessions expire quickly (configurable, default 24h).
- **Permission scope:** `share-link.view` (record-scoped, token-based, not role-based in the normal sense).

## 2.15 Auditor

- **Description:** Internal/external auditor, read-only across the company.
- **Responsibilities:** Review transactions, journal entries, audit logs, approval trails, master data change history for compliance purposes.
- **Menu Access:** Read-only view into every enabled module, full Audit Log, full Reports.
- **Approval Authority:** None — strictly read-only, cannot approve, create, edit, or delete anything.
- **Limitations:** Cannot export bulk PII data without a secondary approval flag (configurable, off by default); every view action is itself logged (auditor's own activity is audited).
- **Permission scope:** `*.view`, `audit-log.view`, `reports.*` — explicitly excludes every `create`/`edit`/`delete`/`approve`/`void` action across all modules.

## 2.16 (Reference) Role → Module Access Summary Matrix

`F` = Full, `R` = Read-only, `A` = Approve (in addition to R/F), `S` = Scoped (own team/warehouse/branch), `-` = No access.

| Module | Owner | Director | Finance | Accounting | HR | Warehouse | Purchasing | Sales | Marketing | Production | Cust. Service | Cashier | Auditor |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| User/Role Mgmt | F | R | - | - | - | - | - | - | - | - | - | - | R |
| Company/Branch/Warehouse | F | R | - | - | - | S | - | - | - | - | - | - | R |
| Product/Inventory | F | R | R | R | - | F(S) | R | R | - | R | R | - | R |
| Purchasing (PR/PO/GR/Return) | F,A | A | R | R | - | F(GR only) | F | - | - | R(MRP) | - | - | R |
| Sales (Quote/SO/DO) | F,A | A | R | R | - | R | - | F,S | R | - | R | - | R |
| Invoice/Payment | F,A | A | F,A | F | - | - | R | R | - | - | - | S | R |
| Accounting/GL/Budget/Assets | F | R | F,A | F | - | - | - | - | - | - | - | - | R |
| Manufacturing (BOM/PO/MRP/QC) | F | R | R | - | - | - | R | - | - | F,S | - | - | R |
| HR/Attendance/Leave/Payroll | F | A(hi) | R(payroll) | - | F,A | - | - | - | - | - | - | - | R |
| Projects/Tasks | F | R | R | - | - | - | - | R | - | R | - | - | R |
| CRM | F | R | - | - | - | - | - | F,S | F,S | - | R | - | R |
| Helpdesk | F | R | - | - | - | - | - | R | - | - | F | - | R |
| POS | F | R | R | R | - | - | - | R | - | - | - | F,S | R |
| Reports/Analytics | F | F | F | F | F(HR) | F(inv) | F(purch) | F(sales) | F(mktg) | F(mfg) | F(cs) | F(own) | F |
| Settings | F | R(delegated) | S(fin.) | - | S(HR) | - | - | - | - | - | - | - | - |
| Audit Logs | F | R | R | R | R | R | R | R | R | R | R | - | F |

This matrix is the source of truth for seeding the default `permissions` and
`role_permissions` tables (see `04-module-authentication.md` §RBAC schema).
Every cell resolves to a concrete list of `module.resource.action` permission
strings at seed-data time; Company Owners can subsequently clone any role and
edit its matrix per company without affecting the system default templates.
