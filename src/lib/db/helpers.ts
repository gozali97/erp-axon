import { getDb } from "./engine";
import { scheduleSave } from "./engine";

export function uid(): string {
  return (
    (globalThis.crypto as Crypto)?.randomUUID?.() ??
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    })
  );
}

export function now(): string {
  return new Date().toISOString();
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function execAll(sql: string, params: any[] = []): Record<string, any>[] {
  const db = getDb();
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

function execRun(sql: string, params: any[] = []): void {
  getDb().run(sql, params);
}

// Currently authenticated user id (set by local auth on sign-in).
let _currentUserId: string | null = null;
export function setCurrentUserId(id: string | null) {
  _currentUserId = id;
}
export function currentUserId(): string | null {
  return _currentUserId;
}

export function nextDocNo(companyId: string, docType: string, prefix: string): string {
  const db = getDb();
  db.run(
    `INSERT INTO doc_number_counters (company_id, doc_type, last_number) VALUES (?, ?, 1)
     ON CONFLICT(company_id, doc_type) DO UPDATE SET last_number = last_number + 1`,
    [companyId, docType],
  );
  const rows = execAll(
    `SELECT last_number AS n FROM doc_number_counters WHERE company_id = ? AND doc_type = ?`,
    [companyId, docType],
  );
  const n = Number(rows[0]?.n ?? 1);
  const ym = new Date().toISOString().slice(0, 7).replace("-", "");
  return `${prefix}-${ym}-${String(n).padStart(5, "0")}`;
}

export function nextMovementNo(companyId: string): string {
  const db = getDb();
  db.run(
    `INSERT INTO movement_number_counters (company_id, last_number) VALUES (?, 1)
     ON CONFLICT(company_id) DO UPDATE SET last_number = last_number + 1`,
    [companyId],
  );
  const rows = execAll(
    `SELECT last_number AS n FROM movement_number_counters WHERE company_id = ?`,
    [companyId],
  );
  const n = Number(rows[0]?.n ?? 1);
  const ym = new Date().toISOString().slice(0, 7).replace("-", "");
  return `MV-${ym}-${String(n).padStart(6, "0")}`;
}

export function getAccountId(companyId: string, code: string): string | null {
  const rows = execAll(`SELECT id FROM accounts WHERE company_id = ? AND code = ? LIMIT 1`, [
    companyId,
    code,
  ]);
  return rows[0]?.id ?? null;
}

export function getOrCreateWalkinCustomer(companyId: string): string {
  const existing = execAll(
    `SELECT id FROM customers WHERE company_id = ? AND code = 'WALKIN' LIMIT 1`,
    [companyId],
  );
  if (existing[0]?.id) return existing[0].id;
  const id = uid();
  execRun(
    `INSERT INTO customers (id, company_id, code, name, payment_terms_days, is_active, created_by) VALUES (?, ?, 'WALKIN', 'Walk-in Customer', 0, 1, ?)`,
    [id, companyId, currentUserId()],
  );
  scheduleSave();
  return id;
}

// Post a journal entry (internal helper used by many RPCs).
export function postJeInternal(
  companyId: string,
  entryDate: string,
  memo: string,
  source: string,
  sourceRef: string | null,
  lines: { account_id: string; debit: number; credit: number; description?: string }[],
): string | null {
  const db = getDb();
  const entryNo = nextDocNo(companyId, "journal_entry", "JE");
  const jeId = uid();
  let totalDebit = 0;
  let totalCredit = 0;
  db.run(
    `INSERT INTO journal_entries (id, company_id, entry_no, entry_date, source, source_ref, memo, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'posted', ?)`,
    [jeId, companyId, entryNo, entryDate, source, sourceRef, memo, currentUserId()],
  );
  let i = 0;
  for (const ln of lines) {
    if (ln.debit === 0 && ln.credit === 0) continue;
    i++;
    db.run(
      `INSERT INTO journal_lines (id, company_id, journal_entry_id, line_no, account_id, description, debit, credit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [uid(), companyId, jeId, i, ln.account_id, ln.description ?? null, ln.debit, ln.credit],
    );
    totalDebit += ln.debit;
    totalCredit += ln.credit;
  }
  db.run(`UPDATE journal_entries SET total_debit = ?, total_credit = ? WHERE id = ?`, [
    totalDebit,
    totalCredit,
    jeId,
  ]);
  scheduleSave();
  return jeId;
}

// Core stock movement poster (weighted average cost). Returns movement id.
export function postStockMovement(args: {
  companyId: string;
  warehouseId: string;
  productId: string;
  movementType: string;
  source: string;
  quantity: number;
  unitCost?: number;
  movementDate?: string;
  sourceRef?: string | null;
  notes?: string | null;
  counterpartyWarehouseId?: string | null;
  batchNo?: string | null;
}): string {
  const {
    companyId,
    warehouseId,
    productId,
    movementType,
    source,
    quantity,
    unitCost = 0,
    movementDate = now(),
    sourceRef = null,
    notes = null,
    counterpartyWarehouseId = null,
    batchNo = null,
  } = args;

  if (quantity <= 0) throw new Error("Quantity must be positive");

  const prodRows = execAll(`SELECT base_unit_id FROM products WHERE id = ? AND company_id = ?`, [
    productId,
    companyId,
  ]);
  const baseUnitId = prodRows[0]?.base_unit_id;
  if (!baseUnitId) throw new Error("Product not found");

  const signedQty =
    movementType === "in" || movementType === "transfer_in"
      ? quantity
      : movementType === "out" || movementType === "transfer_out"
        ? -quantity
        : quantity;

  const movementNo = nextMovementNo(companyId);
  const movementId = uid();
  const totalCost = quantity * unitCost;
  execRun(
    `INSERT INTO stock_movements
      (id, company_id, movement_no, movement_date, movement_type, source, source_ref,
       product_id, warehouse_id, counterparty_warehouse_id, quantity, unit_id, quantity_base,
       unit_cost, total_cost, batch_no, notes, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      movementId,
      companyId,
      movementNo,
      movementDate,
      movementType,
      source,
      sourceRef,
      productId,
      warehouseId,
      counterpartyWarehouseId,
      quantity,
      baseUnitId,
      quantity,
      unitCost,
      totalCost,
      batchNo,
      notes,
      currentUserId(),
    ],
  );

  const balRows = execAll(
    `SELECT quantity_on_hand, average_cost FROM stock_balances
     WHERE company_id = ? AND product_id = ? AND warehouse_id = ?`,
    [companyId, productId, warehouseId],
  );
  const currentQty = Number(balRows[0]?.quantity_on_hand ?? 0);
  const currentAvg = Number(balRows[0]?.average_cost ?? 0);
  const newQty = currentQty + signedQty;
  let newAvg = currentAvg;
  if (signedQty > 0 && unitCost > 0) {
    newAvg = newQty > 0 ? (currentQty * currentAvg + signedQty * unitCost) / newQty : unitCost;
  }
  execRun(
    `INSERT INTO stock_balances (id, company_id, product_id, warehouse_id, quantity_on_hand, average_cost, last_movement_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(product_id, warehouse_id) DO UPDATE SET
       quantity_on_hand = excluded.quantity_on_hand,
       average_cost = excluded.average_cost,
       last_movement_at = excluded.last_movement_at,
       updated_at = excluded.updated_at`,
    [uid(), companyId, productId, warehouseId, newQty, newAvg, now(), now()],
  );
  scheduleSave();
  return movementId;
}
