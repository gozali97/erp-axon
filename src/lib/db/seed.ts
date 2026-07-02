import type { Database } from "sql.js";
import { uid, now, today } from "./helpers";
import { hashPassword, seedDefaultCoa } from "./auth";

const SUPERADMIN_EMAIL = "admin@axon.test";
const SUPERADMIN_PASSWORD = "admin123";

function execAll(db: Database, sql: string, params: any[] = []): Record<string, any>[] {
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: Record<string, any>[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject() as Record<string, any>);
    return rows;
  } finally {
    stmt.free();
  }
}
function execRun(db: Database, sql: string, params: any[] = []): void {
  db.run(sql, params);
}

// Seed the dummy superadmin + a demo company with sample master data so every
// module is immediately usable after first load.
export async function seedIfEmpty(db: Database): Promise<void> {
  const existing = execAll(db, `SELECT id FROM auth_users LIMIT 1`);
  if (existing.length > 0) return;

  // ---- superadmin user ----
  const adminId = uid();
  const hash = await hashPassword(SUPERADMIN_PASSWORD);
  execRun(db, `INSERT INTO auth_users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)`, [
    adminId,
    SUPERADMIN_EMAIL,
    hash,
    now(),
  ]);

  // ---- demo company / branch / warehouse ----
  const companyId = uid();
  execRun(
    db,
    `INSERT INTO companies (id, name, legal_name, base_currency, timezone, is_active, created_by) VALUES (?, 'PT Axon Demo Sejahtera', 'PT Axon Demo Sejahtera', 'IDR', 'Asia/Jakarta', 1, ?)`,
    [companyId, adminId],
  );
  const branchId = uid();
  execRun(
    db,
    `INSERT INTO branches (id, company_id, code, name, is_active) VALUES (?, ?, 'MAIN', 'Kantor Pusat', 1)`,
    [branchId, companyId],
  );
  const wh1 = uid();
  const wh2 = uid();
  execRun(
    db,
    `INSERT INTO warehouses (id, company_id, branch_id, code, name, is_default, is_active) VALUES (?, ?, ?, 'MAIN-WH', 'Gudang Pusat', 1, 1)`,
    [wh1, companyId, branchId],
  );
  execRun(
    db,
    `INSERT INTO warehouses (id, company_id, branch_id, code, name, is_default, is_active) VALUES (?, ?, ?, 'WH-02', 'Gudang Cabang', 0, 1)`,
    [wh2, companyId, branchId],
  );

  execRun(db, `INSERT INTO user_roles (id, user_id, company_id, role) VALUES (?, ?, ?, 'owner')`, [
    uid(),
    adminId,
    companyId,
  ]);
  execRun(db, `INSERT INTO user_warehouse_access (id, user_id, warehouse_id) VALUES (?, ?, ?)`, [
    uid(),
    adminId,
    wh1,
  ]);
  execRun(db, `INSERT INTO user_warehouse_access (id, user_id, warehouse_id) VALUES (?, ?, ?)`, [
    uid(),
    adminId,
    wh2,
  ]);
  execRun(
    db,
    `INSERT INTO profiles (id, display_name, email, active_company_id) VALUES (?, 'Super Admin', ?, ?)`,
    [adminId, SUPERADMIN_EMAIL, companyId],
  );

  // ---- units ----
  const unitIds: Record<string, string> = {};
  for (const [code, name, cat] of [
    ["PCS", "Pieces", "count"],
    ["BOX", "Box", "count"],
    ["KG", "Kilogram", "weight"],
    ["G", "Gram", "weight"],
    ["L", "Liter", "volume"],
    ["M", "Meter", "length"],
  ] as const) {
    const id = uid();
    unitIds[code] = id;
    execRun(
      db,
      `INSERT INTO units (id, company_id, code, name, category, is_active) VALUES (?, ?, ?, ?, ?, 1)`,
      [id, companyId, code, name, cat],
    );
  }

  // ---- categories ----
  const catId = uid();
  execRun(
    db,
    `INSERT INTO categories (id, company_id, code, name, is_active) VALUES (?, ?, 'GEN', 'General', 1)`,
    [catId, companyId],
  );

  // ---- chart of accounts ----
  seedDefaultCoa(companyId);

  // ---- products ----
  const products: {
    id: string;
    sku: string;
    name: string;
    type: string;
    sale: number;
    purchase: number;
  }[] = [];
  const productDefs: [string, string, string, number, number][] = [
    ["SKU-001", "Beras Premium 5kg", "stockable", 75000, 60000],
    ["SKU-002", "Minyak Goreng 2L", "stockable", 38000, 30000],
    ["SKU-003", "Gula Pasir 1kg", "stockable", 16000, 12000],
    ["SKU-004", "Kopi Robusta 250g", "stockable", 45000, 35000],
    ["SKU-005", "Teh Celup Box", "stockable", 12000, 8000],
    ["SRV-001", "Jasa Pengiriman", "service", 25000, 0],
  ];
  for (const [sku, name, type, sale, purchase] of productDefs) {
    const id = uid();
    products.push({ id, sku, name, type, sale, purchase });
    execRun(
      db,
      `INSERT INTO products (id, company_id, sku, name, product_type, valuation_method, sale_price, purchase_price, base_unit_id, category_id, is_active)
       VALUES (?, ?, ?, ?, ?, 'average', ?, ?, ?, ?, 1)`,
      [id, companyId, sku, name, type, sale, purchase, unitIds["PCS"], catId],
    );
  }

  // opening stock for stockable products in main warehouse
  for (const p of products) {
    if (p.type !== "stockable") continue;
    execRun(
      db,
      `INSERT INTO stock_balances (id, company_id, product_id, warehouse_id, quantity_on_hand, average_cost, updated_at)
       VALUES (?, ?, ?, ?, 100, ?, ?)`,
      [uid(), companyId, p.id, wh1, p.purchase, now()],
    );
  }

  // ---- suppliers ----
  const suppliers: string[] = [];
  for (const [code, name] of [
    ["SUP-001", "PT Sumber Pangan"],
    ["SUP-002", "CV Mitra Distribusi"],
  ] as const) {
    const id = uid();
    suppliers.push(id);
    execRun(
      db,
      `INSERT INTO suppliers (id, company_id, code, name, email, phone, payment_terms_days, is_active) VALUES (?, ?, ?, ?, ?, ?, 30, 1)`,
      [id, companyId, code, name, `${code.toLowerCase()}@supplier.test`, "081200000001"],
    );
  }

  // ---- customers ----
  const customers: string[] = [];
  for (const [code, name] of [
    ["CUST-001", "Toko Maju Jaya"],
    ["CUST-002", "Restoran Bahari"],
    ["WALKIN", "Walk-in Customer"],
  ] as const) {
    const id = uid();
    customers.push(id);
    execRun(
      db,
      `INSERT INTO customers (id, company_id, code, name, payment_terms_days, is_active) VALUES (?, ?, ?, ?, 30, 1)`,
      [id, companyId, code, name],
    );
  }

  // ---- departments & positions & employee ----
  const deptId = uid();
  execRun(
    db,
    `INSERT INTO departments (id, company_id, code, name, is_active) VALUES (?, ?, 'OPS', 'Operasional', 1)`,
    [deptId, companyId],
  );
  const posId = uid();
  execRun(
    db,
    `INSERT INTO positions (id, company_id, code, title, department_id, is_active) VALUES (?, ?, 'STF', 'Staff', ?, 1)`,
    [posId, companyId, deptId],
  );
  const empId = uid();
  execRun(
    db,
    `INSERT INTO employees (id, company_id, employee_no, full_name, email, department_id, position_id, employment_type, employment_status, hire_date, base_salary, allowance_fixed)
     VALUES (?, ?, 'EMP-001', 'Budi Santoso', 'budi@axon.test', ?, ?, 'permanent', 'active', ?, 5000000, 500000)`,
    [empId, companyId, deptId, posId, today()],
  );

  // ---- leads & opportunities ----
  const leadId = uid();
  execRun(
    db,
    `INSERT INTO leads (id, company_id, name, company_name, email, phone, source, status, estimated_value) VALUES (?, ?, 'Andi Wijaya', 'PT Cendana', 'andi@cendana.test', '081299999999', 'website', 'new', 5000000)`,
    [leadId, companyId],
  );
  execRun(
    db,
    `INSERT INTO opportunities (id, company_id, name, customer_id, stage, amount, probability) VALUES (?, ?, 'Cendana Deal', ?, 'prospecting', 5000000, 20)`,
    [uid(), companyId, customers[0]],
  );

  // ---- BOM (simple: service product has no BOM; create one for a stockable) ----
  const bomId = uid();
  execRun(
    db,
    `INSERT INTO bills_of_materials (id, company_id, product_id, code, version, output_quantity, is_active) VALUES (?, ?, ?, 'BOM-001', 'v1', 1, 1)`,
    [bomId, companyId, products[0].id],
  );
  execRun(
    db,
    `INSERT INTO bom_components (id, company_id, bom_id, component_product_id, quantity) VALUES (?, ?, ?, ?, 1)`,
    [uid(), companyId, bomId, products[1].id],
  );

  // ---- CMS landing content ----
  const cmsContent: Record<string, any> = {
    hero: {
      eyebrow: "Modular ERP Architecture",
      title: "The Operating System for Complex Mid-Market Ops.",
      subtitle:
        "Consolidate Sales, Inventory, and Accounting into a single API-first backbone. Built for multi-entity structures that have outgrown Odoo and reject SAP overhead.",
      ctaPrimary: "Deploy Instance",
      ctaSecondary: "View API Schema",
    },
    tagline: { text: "Dipercaya SME & mid-market Indonesia" },
    cta: {
      title: "Stop paying for features you don't deploy.",
      subtitle:
        "Modular pricing starts at $499/mo + compute usage. No per-seat penalties, no vendor lock-in.",
      button: "Talk to Solutions Architect",
    },
  };
  for (const [key, value] of Object.entries(cmsContent)) {
    execRun(db, `INSERT INTO cms_landing_content (key, value, updated_at) VALUES (?, ?, ?)`, [
      key,
      JSON.stringify(value),
      now(),
    ]);
  }

  // ---- one published blog post ----
  execRun(
    db,
    `INSERT INTO cms_posts (id, slug, title, excerpt, body, status, published_at, author_id) VALUES (?, 'welcome-to-axon', 'Selamat datang di Axon ERP', 'Pengantar ERP modular Axon.', 'Axon adalah ERP modular API-first untuk mid-market.', 'published', ?, ?)`,
    [uid(), now(), adminId],
  );
}
