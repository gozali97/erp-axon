// SQLite schema mirroring the original Supabase/Postgres migrations.
// - UUID -> TEXT (generated in app layer via crypto.randomUUID())
// - BOOLEAN -> INTEGER (0/1)
// - ENUM -> TEXT + CHECK
// - TIMESTAMPTZ / DATE -> TEXT (ISO 8601)
// - NUMERIC kept as NUMERIC (SQLite dynamic typing)

export const SCHEMA_SQL = `
-- ============ AUTH (local) ============
CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ CORE / TENANCY ============
CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  legal_name TEXT,
  base_currency TEXT NOT NULL DEFAULT 'IDR',
  timezone TEXT NOT NULL DEFAULT 'Asia/Jakarta',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, code)
);
CREATE INDEX IF NOT EXISTS idx_branches_company_id ON branches(company_id);

CREATE TABLE IF NOT EXISTS warehouses (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  allow_negative_stock INTEGER NOT NULL DEFAULT 0,
  is_default INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, code)
);
CREATE INDEX IF NOT EXISTS idx_wh_company ON warehouses(company_id);

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  display_name TEXT,
  email TEXT,
  avatar_url TEXT,
  active_company_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  company_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner','director','finance','purchasing','sales','warehouse','viewer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, company_id, role)
);
CREATE INDEX IF NOT EXISTS idx_ur_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_ur_company ON user_roles(company_id);

CREATE TABLE IF NOT EXISTS user_warehouse_access (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (user_id, warehouse_id)
);

-- ============ MASTER DATA ============
CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'count' CHECK (category IN ('count','weight','volume','length','area','time','other')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, code)
);
CREATE INDEX IF NOT EXISTS idx_units_company ON units(company_id);

CREATE TABLE IF NOT EXISTS unit_conversions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  from_unit_id TEXT NOT NULL,
  to_unit_id TEXT NOT NULL,
  factor NUMERIC NOT NULL DEFAULT 1 CHECK (factor > 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, from_unit_id, to_unit_id),
  CHECK (from_unit_id <> to_unit_id)
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  parent_id TEXT,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, code)
);
CREATE INDEX IF NOT EXISTS idx_cat_company ON categories(company_id);
CREATE INDEX IF NOT EXISTS idx_cat_parent ON categories(parent_id);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  sku TEXT NOT NULL,
  barcode TEXT,
  name TEXT NOT NULL,
  description TEXT,
  category_id TEXT,
  base_unit_id TEXT NOT NULL,
  product_type TEXT NOT NULL DEFAULT 'stockable' CHECK (product_type IN ('stockable','service','consumable')),
  valuation_method TEXT NOT NULL DEFAULT 'average' CHECK (valuation_method IN ('fifo','lifo','average','standard')),
  sale_price NUMERIC NOT NULL DEFAULT 0 CHECK (sale_price >= 0),
  purchase_price NUMERIC NOT NULL DEFAULT 0 CHECK (purchase_price >= 0),
  min_stock NUMERIC NOT NULL DEFAULT 0,
  max_stock NUMERIC,
  reorder_point NUMERIC,
  track_batch INTEGER NOT NULL DEFAULT 0,
  track_serial INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  image_url TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, sku)
);
CREATE INDEX IF NOT EXISTS idx_prod_company ON products(company_id);
CREATE INDEX IF NOT EXISTS idx_prod_category ON products(category_id);

CREATE TABLE IF NOT EXISTS product_units (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  unit_id TEXT NOT NULL,
  factor_to_base NUMERIC NOT NULL DEFAULT 1 CHECK (factor_to_base > 0),
  is_purchase_default INTEGER NOT NULL DEFAULT 0,
  is_sale_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (product_id, unit_id)
);
CREATE INDEX IF NOT EXISTS idx_pu_product ON product_units(product_id);

-- ============ INVENTORY ============
CREATE TABLE IF NOT EXISTS stock_balances (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  quantity_on_hand NUMERIC NOT NULL DEFAULT 0,
  quantity_reserved NUMERIC NOT NULL DEFAULT 0,
  average_cost NUMERIC NOT NULL DEFAULT 0,
  last_movement_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (product_id, warehouse_id)
);
CREATE INDEX IF NOT EXISTS idx_sb_pw ON stock_balances(product_id, warehouse_id);

CREATE TABLE IF NOT EXISTS stock_movements (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  movement_no TEXT NOT NULL,
  movement_date TEXT NOT NULL DEFAULT (datetime('now')),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('in','out','transfer_in','transfer_out','adjustment','opname')),
  source TEXT NOT NULL CHECK (source IN ('purchase','sale','production','transfer','adjustment','opname','opening','return_in','return_out')),
  source_ref TEXT,
  product_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  counterparty_warehouse_id TEXT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_id TEXT NOT NULL,
  quantity_base NUMERIC NOT NULL CHECK (quantity_base > 0),
  unit_cost NUMERIC NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  total_cost NUMERIC NOT NULL DEFAULT 0,
  batch_no TEXT,
  serial_no TEXT,
  expiry_date TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, movement_no)
);
CREATE INDEX IF NOT EXISTS idx_sm_company_date ON stock_movements(company_id, movement_date);
CREATE INDEX IF NOT EXISTS idx_sm_product ON stock_movements(product_id);

CREATE TABLE IF NOT EXISTS stock_cost_layers (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  movement_id TEXT,
  received_at TEXT NOT NULL DEFAULT (datetime('now')),
  quantity_remaining NUMERIC NOT NULL DEFAULT 0 CHECK (quantity_remaining >= 0),
  unit_cost NUMERIC NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_scl_pw ON stock_cost_layers(product_id, warehouse_id, received_at);

CREATE TABLE IF NOT EXISTS movement_number_counters (
  company_id TEXT PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS doc_number_counters (
  company_id TEXT NOT NULL,
  doc_type TEXT NOT NULL,
  last_number INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, doc_type)
);

-- ============ PROCUREMENT ============
CREATE TABLE IF NOT EXISTS suppliers (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  payment_terms_days INTEGER NOT NULL DEFAULT 30,
  currency TEXT NOT NULL DEFAULT 'IDR',
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  po_no TEXT NOT NULL,
  supplier_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  order_date TEXT NOT NULL DEFAULT (date('now')),
  expected_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','partial','received','closed','cancelled')),
  currency TEXT NOT NULL DEFAULT 'IDR',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_total NUMERIC NOT NULL DEFAULT 0,
  grand_total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, po_no)
);

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  purchase_order_id TEXT NOT NULL,
  line_no INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC NOT NULL,
  quantity_received NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_pct NUMERIC NOT NULL DEFAULT 0,
  tax_pct NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (purchase_order_id, line_no)
);

CREATE TABLE IF NOT EXISTS goods_receipts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  gr_no TEXT NOT NULL,
  purchase_order_id TEXT,
  supplier_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  receipt_date TEXT NOT NULL DEFAULT (datetime('now')),
  supplier_ref TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, gr_no)
);

CREATE TABLE IF NOT EXISTS goods_receipt_lines (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  goods_receipt_id TEXT NOT NULL,
  purchase_order_line_id TEXT,
  product_id TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  movement_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ SALES ============
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  legal_name TEXT,
  tax_id TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  country TEXT,
  currency TEXT NOT NULL DEFAULT 'IDR',
  payment_terms_days INTEGER NOT NULL DEFAULT 30,
  credit_limit NUMERIC NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS sales_orders (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  so_no TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  order_date TEXT NOT NULL DEFAULT (date('now')),
  expected_date TEXT,
  customer_ref TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','partial','delivered','closed','cancelled')),
  currency TEXT NOT NULL DEFAULT 'IDR',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_total NUMERIC NOT NULL DEFAULT 0,
  grand_total NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, so_no)
);

CREATE TABLE IF NOT EXISTS sales_order_lines (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  sales_order_id TEXT NOT NULL,
  line_no INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC NOT NULL,
  quantity_delivered NUMERIC NOT NULL DEFAULT 0,
  quantity_invoiced NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_pct NUMERIC NOT NULL DEFAULT 0,
  tax_pct NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS delivery_orders (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  do_no TEXT NOT NULL,
  sales_order_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  delivery_date TEXT NOT NULL DEFAULT (datetime('now')),
  carrier TEXT,
  tracking_no TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, do_no)
);

CREATE TABLE IF NOT EXISTS delivery_order_lines (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  delivery_order_id TEXT NOT NULL,
  sales_order_line_id TEXT,
  product_id TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  movement_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS customer_invoices (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  invoice_no TEXT NOT NULL,
  sales_order_id TEXT,
  customer_id TEXT NOT NULL,
  invoice_date TEXT NOT NULL DEFAULT (date('now')),
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft','issued','partial','paid','void')),
  currency TEXT NOT NULL DEFAULT 'IDR',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_total NUMERIC NOT NULL DEFAULT 0,
  grand_total NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, invoice_no)
);

CREATE TABLE IF NOT EXISTS customer_invoice_lines (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  sales_order_line_id TEXT,
  line_no INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  description TEXT,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  discount_pct NUMERIC NOT NULL DEFAULT 0,
  tax_pct NUMERIC NOT NULL DEFAULT 0,
  line_total NUMERIC NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============ ACCOUNTING ============
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset','liability','equity','revenue','expense')),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit','credit')),
  parent_id TEXT,
  is_group INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, code)
);
CREATE INDEX IF NOT EXISTS idx_acc_company_type ON accounts(company_id, account_type);

CREATE TABLE IF NOT EXISTS journal_entries (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  entry_no TEXT NOT NULL,
  entry_date TEXT NOT NULL DEFAULT (date('now')),
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','sales','purchase','inventory','payment','opening')),
  source_ref TEXT,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('draft','posted','void')),
  total_debit NUMERIC NOT NULL DEFAULT 0,
  total_credit NUMERIC NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, entry_no)
);
CREATE INDEX IF NOT EXISTS idx_je_company_date ON journal_entries(company_id, entry_date);

CREATE TABLE IF NOT EXISTS journal_lines (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  journal_entry_id TEXT NOT NULL,
  line_no INTEGER NOT NULL,
  account_id TEXT NOT NULL,
  description TEXT,
  debit NUMERIC NOT NULL DEFAULT 0,
  credit NUMERIC NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (debit >= 0 AND credit >= 0),
  CHECK (NOT (debit > 0 AND credit > 0))
);
CREATE INDEX IF NOT EXISTS idx_jl_entry ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_jl_account ON journal_lines(company_id, account_id);

-- ============ POS ============
CREATE TABLE IF NOT EXISTS pos_payments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  payment_no TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','card','transfer','qris','other')),
  amount NUMERIC NOT NULL CHECK (amount > 0),
  reference TEXT,
  cash_account_id TEXT,
  journal_entry_id TEXT,
  paid_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, payment_no)
);

-- ============ HR ============
CREATE TABLE IF NOT EXISTS departments (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT,
  manager_employee_id TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS positions (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  code TEXT NOT NULL,
  title TEXT NOT NULL,
  department_id TEXT,
  level TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  employee_no TEXT NOT NULL,
  user_id TEXT,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  gender TEXT,
  birth_date TEXT,
  national_id TEXT,
  tax_id TEXT,
  address TEXT,
  department_id TEXT,
  position_id TEXT,
  manager_id TEXT,
  employment_type TEXT NOT NULL DEFAULT 'permanent' CHECK (employment_type IN ('permanent','contract','probation','intern','freelance')),
  employment_status TEXT NOT NULL DEFAULT 'active' CHECK (employment_status IN ('active','on_leave','resigned','terminated')),
  hire_date TEXT NOT NULL DEFAULT (date('now')),
  resign_date TEXT,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  allowance_fixed NUMERIC NOT NULL DEFAULT 0,
  bank_name TEXT,
  bank_account TEXT,
  annual_leave_quota NUMERIC NOT NULL DEFAULT 12,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  UNIQUE (company_id, employee_no)
);
CREATE INDEX IF NOT EXISTS idx_emp_company ON employees(company_id);
CREATE INDEX IF NOT EXISTS idx_emp_dept ON employees(department_id);

CREATE TABLE IF NOT EXISTS attendances (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  attendance_date TEXT NOT NULL,
  clock_in TEXT,
  clock_out TEXT,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present','late','absent','leave','holiday')),
  work_hours NUMERIC NOT NULL DEFAULT 0,
  overtime_hours NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, employee_id, attendance_date)
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  request_no TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  leave_type TEXT NOT NULL DEFAULT 'annual' CHECK (leave_type IN ('annual','sick','maternity','paternity','unpaid','other')),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days NUMERIC NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft','submitted','approved','rejected','cancelled')),
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  UNIQUE (company_id, request_no)
);

CREATE TABLE IF NOT EXISTS payroll_runs (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  run_no TEXT NOT NULL,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  pay_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved','posted','paid')),
  total_gross NUMERIC NOT NULL DEFAULT 0,
  total_deductions NUMERIC NOT NULL DEFAULT 0,
  total_net NUMERIC NOT NULL DEFAULT 0,
  journal_entry_id TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  UNIQUE (company_id, run_no),
  UNIQUE (company_id, period_year, period_month)
);

CREATE TABLE IF NOT EXISTS payroll_lines (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  payroll_run_id TEXT NOT NULL,
  employee_id TEXT NOT NULL,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  allowance NUMERIC NOT NULL DEFAULT 0,
  overtime NUMERIC NOT NULL DEFAULT 0,
  bonus NUMERIC NOT NULL DEFAULT 0,
  deduction NUMERIC NOT NULL DEFAULT 0,
  tax NUMERIC NOT NULL DEFAULT 0,
  gross_pay NUMERIC NOT NULL DEFAULT 0,
  net_pay NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (payroll_run_id, employee_id)
);

-- ============ MANUFACTURING ============
CREATE TABLE IF NOT EXISTS bills_of_materials (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  code TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT 'v1',
  output_quantity NUMERIC NOT NULL DEFAULT 1,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_by TEXT,
  UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS bom_components (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  bom_id TEXT NOT NULL,
  component_product_id TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  waste_pct NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (bom_id, component_product_id)
);

CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  wo_no TEXT NOT NULL,
  bom_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  warehouse_id TEXT NOT NULL,
  planned_qty NUMERIC NOT NULL CHECK (planned_qty > 0),
  produced_qty NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','released','in_progress','completed','cancelled')),
  planned_start TEXT,
  planned_end TEXT,
  actual_start TEXT,
  actual_end TEXT,
  notes TEXT,
  journal_entry_id TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (company_id, wo_no)
);
CREATE INDEX IF NOT EXISTS idx_wo_company_status ON work_orders(company_id, status);

CREATE TABLE IF NOT EXISTS work_order_components (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  work_order_id TEXT NOT NULL,
  component_product_id TEXT NOT NULL,
  planned_qty NUMERIC NOT NULL,
  consumed_qty NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  movement_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_woc_wo ON work_order_components(work_order_id);

-- ============ CRM ============
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  source TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','qualified','unqualified','converted')),
  estimated_value NUMERIC DEFAULT 0,
  assigned_to TEXT,
  converted_customer_id TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_leads_company_status ON leads(company_id, status);

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  name TEXT NOT NULL,
  customer_id TEXT,
  lead_id TEXT,
  stage TEXT NOT NULL DEFAULT 'prospecting' CHECK (stage IN ('prospecting','qualification','proposal','negotiation','won','lost')),
  amount NUMERIC NOT NULL DEFAULT 0,
  probability INTEGER NOT NULL DEFAULT 10 CHECK (probability BETWEEN 0 AND 100),
  expected_close_date TEXT,
  actual_close_date TEXT,
  assigned_to TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_opp_company_stage ON opportunities(company_id, stage);

CREATE TABLE IF NOT EXISTS crm_activities (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('call','email','meeting','note','task')),
  subject TEXT NOT NULL,
  description TEXT,
  lead_id TEXT,
  opportunity_id TEXT,
  customer_id TEXT,
  due_at TEXT,
  completed_at TEXT,
  assigned_to TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_act_company ON crm_activities(company_id);

-- ============ CMS ============
CREATE TABLE IF NOT EXISTS cms_landing_content (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by TEXT
);

CREATE TABLE IF NOT EXISTS cms_posts (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  body TEXT,
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at TEXT,
  author_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;
