# 1. Executive Summary

## 1.1 Business Problems

| # | Problem | Impact |
|---|---|---|
| P1 | SMEs and mid-market companies rely on disconnected tools (spreadsheets, standalone accounting software, WhatsApp for approvals) for inventory, sales, purchasing, and finance. | Data inconsistency, duplicated entry, no single source of truth. |
| P2 | Existing commercial ERPs (SAP B1, Dynamics 365, NetSuite) are cost-prohibitive and over-engineered for SME/mid-market needs, with long implementation cycles. | High TCO, slow time-to-value, vendor lock-in. |
| P3 | Open-source alternatives (Odoo, ERPNext) require heavy customization and lack a modern, fast, type-safe frontend; module coupling makes selective adoption hard. | High customization cost, poor UX, difficult to extend safely. |
| P4 | Multi-entity businesses (multiple companies, branches, warehouses) struggle to get consolidated visibility while keeping entity-level autonomy (separate COA, separate approval chains). | Manual consolidation, delayed decision-making. |
| P5 | Industry-specific workflows (manufacturing BOM/MRP, healthcare/pharmacy batch & expiry tracking, restaurant POS, construction project costing) are not well served by generic ERPs without expensive add-ons. | Forces businesses into rigid, ill-fitting processes. |
| P6 | No affordable ERP ships with an API-first, modular architecture that supports future mobile apps and AI features (OCR, forecasting, natural language) out of the box. | Businesses re-platform later at high cost. |

## 1.2 Business Goals

1. Deliver a modular ERP where every module (Sales, Purchasing, Inventory, Accounting, Manufacturing, HR, CRM, POS, etc.) can be independently enabled/disabled per company without breaking core functionality.
2. Support multi-company, multi-branch, multi-warehouse operations natively, with consolidated and entity-level reporting.
3. Provide an API-first backend so the same system can power web, future mobile apps, and third-party integrations without rework.
4. Achieve implementation timelines measured in days-to-weeks (SME) rather than months (typical for SAP B1/Dynamics), through sane defaults and guided setup wizards.
5. Be industry-adaptable: a shared core plus industry-specific module packs (Manufacturing, Healthcare/Pharmacy, Construction, Restaurant/Hospital, Education, Logistics).
6. Build a foundation ready for AI-assisted operation (natural language search, OCR document capture, demand forecasting) from Phase 4 onward without architectural rework.

## 1.3 Objectives (measurable, tied to release phases)

| Objective | Target | Phase |
|---|---|---|
| Core transactional loop functional (Procure-to-Pay, Order-to-Cash, Inventory) | 100% of documented workflows pass acceptance criteria | Phase 1–3 |
| Multi-company/branch/warehouse data isolation | Zero cross-tenant data leakage in security testing | Phase 1 |
| API coverage | Every UI action backed by a documented, versioned REST endpoint | Ongoing, tracked per module |
| Module toggling | Disabling a module removes its menu, routes, and permissions without errors elsewhere | Phase 1 (framework), validated each phase |
| Report generation performance | Standard reports (P&L, Stock Valuation, Sales Summary) render in <3s for 100k rows | Phase 4 |
| Accessibility | WCAG 2.1 AA on all core transactional screens | Ongoing |
| Offline resilience | POS and stock-count screens function offline and sync on reconnect | Phase 3/5 |

## 1.4 Success Metrics / KPIs

- **Adoption:** % of enabled modules actually used weekly per company (target >70% of enabled modules).
- **Data quality:** Rate of failed/duplicate transactions caught by validation before posting (target: duplicate invoice/PO rate <0.1%).
- **Performance:** P95 API response time <400ms for list endpoints, <150ms for single-record GET.
- **Reliability:** 99.5% uptime SLA (self-hosted deployments excluded from SLA, cloud-hosted included).
- **Time-to-value:** Median time from signup to first posted Sales Order <2 hours (guided setup).
- **Support load:** Ticket volume per active company per month, trending down release over release.

## 1.5 Scope

**In scope (full product, delivered across phases as listed in `00-README.md`):**
- All 18 sections and ~50 modules listed in the master brief, including Authentication, RBAC, multi-company/branch/warehouse, Inventory, full Procure-to-Pay, full Order-to-Cash, Accounting/GL, Manufacturing (BOM/MRP/QC/Maintenance), HR/Payroll, Projects/Tasks, CRM/Helpdesk, POS, Reporting/Analytics, Notifications, Audit Logs, Settings.
- REST API for every module, React 19 frontend for every module.
- Role-based access control with a full permission matrix.
- Multi-currency, multi-tax-regime support at the data-model level (region-specific tax engines are configuration, not custom code, per company).

**Out of scope (v1, all phases in this brief):**
- Native mobile apps (architecture will support them; the apps themselves are a separate project, per Section 17 Phase 4 / Section 18).
- Country-specific statutory e-invoicing/e-tax integrations beyond a generic pluggable tax/fiscal-document interface (specific country connectors are follow-on work).
- Full AI features (Section 18) beyond the extensibility hooks — actual AI Assistant, OCR, forecasting are Phase 8+ and depend on model/infra decisions outside this PRD's scope.
- Payroll statutory compliance for every country (payroll engine is generic; per-country tax tables are configuration packs, delivered incrementally).
- Hardware integrations (barcode scanners, fiscal printers, RFID) beyond a documented device-abstraction API — specific drivers are follow-on work.

## 1.6 Business Value

- Reduces total cost of ownership vs. tier-1 ERPs by 60–80% for SME/mid-market segment (subscription + no mandatory implementation partner for core setup).
- Reduces integration cost for adopters via API-first design — every screen's data is reachable via documented REST endpoints from day one.
- Reduces operational risk via built-in approval hierarchies, audit trail, and negative-stock/duplicate-document prevention rules (see `11-business-rules.md`, delivered in a later phase).
- Creates a platform businesses do not have to abandon as they grow — multi-company/branch/warehouse and modular enablement mean the same install scales from a single-branch retailer to a multi-entity group.

## 1.7 Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Scope creep across ~50 modules causes inconsistent data model / duplicated logic | High | High | Enforce shared core conventions (`00-README.md` §Global Conventions) before any module is built; central review of every new module's schema against core. |
| Module toggling introduces hidden coupling (e.g. Sales assumes Accounting is always on) | Medium | High | Every module declares hard vs. soft dependencies explicitly; hard-dependent modules cannot be enabled without their dependency; soft dependencies degrade gracefully (e.g. Sales works without Accounting but skips GL posting). |
| Multi-tenancy bugs cause cross-company data leakage | Low | Critical | `company_id` scoping enforced at the query-builder/global-scope level in Laravel, not per-controller; automated tenant-isolation test suite. |
| Performance degradation as transactional tables grow (stock movements, journal entries) | Medium | Medium | Partitioning/archival strategy defined in `03-database-design-core.md`; indexing strategy reviewed per module. |
| Offline mode (POS, stock count) causes sync conflicts | Medium | Medium | Conflict resolution strategy (last-write-wins with audit log + manual reconciliation queue) defined when POS/offline module is built (Phase 3/5). |
| Regulatory/tax requirements vary too much per country for a generic engine | High | Medium | Tax/fiscal-document logic is pluggable per company (strategy pattern), not hardcoded; documented extension points. |

## 1.8 Assumptions

1. Deployment targets are primarily cloud (managed MySQL) for production and SQLite for local/dev — no requirement to support on-prem Oracle/SQL Server in v1.
2. Single default currency per company, with multi-currency support at the transaction level (documents can be in a foreign currency, converted to company base currency for GL).
3. JWT-based auth is acceptable for v1 (no SSO/SAML requirement yet; can be added as an Authentication module extension).
4. Users have modern browsers (last 2 versions of Chrome, Edge, Firefox, Safari); no IE11 support.
5. Initial target company size: 5–500 employees; architecture should not preclude larger, but enterprise-scale features (e.g. advanced MRP, multi-level approval matrices) are prioritized accordingly.
6. Each company decides its own chart of accounts and numbering formats during onboarding; the system ships with industry-specific starter templates, not a mandatory global COA.
