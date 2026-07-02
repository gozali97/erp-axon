import { getDb } from "./engine";
import { scheduleSave } from "./engine";
import {
  uid,
  now,
  today,
  nextDocNo,
  currentUserId,
  getAccountId,
  getOrCreateWalkinCustomer,
  postJeInternal,
  postStockMovement,
} from "./helpers";

type RpcResult = { data: any; error: { message: string } | null };

function ok(data: any = null): RpcResult {
  return { data, error: null };
}
function err(message: string): RpcResult {
  return { data: null, error: { message } };
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

type Line = {
  product_id: string;
  description?: string | null;
  quantity: number;
  unit_price: number;
  discount_pct?: number;
  tax_pct?: number;
  so_line_id?: string;
  po_line_id?: string;
  unit_cost?: number;
};

function lineTotals(l: Line) {
  const gross = Number(l.quantity) * Number(l.unit_price);
  const afterDisc = gross * (1 - (Number(l.discount_pct ?? 0) || 0) / 100);
  const tax = afterDisc * ((Number(l.tax_pct ?? 0) || 0) / 100);
  return { gross, afterDisc, tax, lineTotal: afterDisc + tax };
}

// ---------- STOCK ----------
function post_stock_movement(p: any): RpcResult {
  try {
    const id = postStockMovement({
      companyId: p._company_id,
      warehouseId: p._warehouse_id,
      productId: p._product_id,
      movementType: p._movement_type,
      source: p._source,
      quantity: Number(p._quantity),
      unitCost: p._unit_cost != null ? Number(p._unit_cost) : 0,
      movementDate: p._movement_date,
      sourceRef: p._source_ref,
      notes: p._notes,
      counterpartyWarehouseId: p._counterparty_warehouse_id,
      batchNo: p._batch_no,
    });
    return ok(id);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

function post_stock_transfer(p: any): RpcResult {
  try {
    if (p._from_warehouse === p._to_warehouse)
      throw new Error("Source and destination must differ");
    const balRows = execAll(
      `SELECT average_cost FROM stock_balances WHERE company_id=? AND product_id=? AND warehouse_id=?`,
      [p._company_id, p._product_id, p._from_warehouse],
    );
    const avg = Number(balRows[0]?.average_cost ?? 0);
    const cost = p._unit_cost != null && Number(p._unit_cost) !== 0 ? Number(p._unit_cost) : avg;
    const outId = postStockMovement({
      companyId: p._company_id,
      warehouseId: p._from_warehouse,
      productId: p._product_id,
      movementType: "transfer_out",
      source: "transfer",
      quantity: Number(p._quantity),
      unitCost: cost,
      movementDate: p._movement_date,
      notes: p._notes,
      counterpartyWarehouseId: p._to_warehouse,
    });
    postStockMovement({
      companyId: p._company_id,
      warehouseId: p._to_warehouse,
      productId: p._product_id,
      movementType: "transfer_in",
      source: "transfer",
      quantity: Number(p._quantity),
      unitCost: cost,
      movementDate: p._movement_date,
      sourceRef: outId,
      notes: p._notes,
      counterpartyWarehouseId: p._from_warehouse,
    });
    return ok(outId);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

function post_stock_adjustment(p: any): RpcResult {
  try {
    const delta = Number(p._delta);
    if (delta === 0) throw new Error("Delta cannot be zero");
    const type = delta > 0 ? "in" : "out";
    const qty = Math.abs(delta);
    const source = p._source ?? "adjustment";
    const id = postStockMovement({
      companyId: p._company_id,
      warehouseId: p._warehouse_id,
      productId: p._product_id,
      movementType: type,
      source,
      quantity: qty,
      unitCost: p._unit_cost != null ? Number(p._unit_cost) : 0,
      notes: p._notes,
    });
    return ok(id);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ---------- PROCUREMENT ----------
function create_purchase_order(p: any): RpcResult {
  try {
    const lines = p._lines as Line[];
    if (!lines?.length) throw new Error("PO must have at least one line");
    const poNo = nextDocNo(p._company_id, "purchase_order", "PO");
    const poId = uid();
    execRun(
      `INSERT INTO purchase_orders (id, company_id, po_no, supplier_id, warehouse_id, order_date, expected_date, notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)`,
      [
        poId,
        p._company_id,
        poNo,
        p._supplier_id,
        p._warehouse_id,
        p._order_date,
        p._expected_date ?? null,
        p._notes ?? null,
        currentUserId(),
      ],
    );
    let subtotal = 0;
    let taxTotal = 0;
    let i = 0;
    for (const l of lines) {
      i++;
      const { afterDisc, tax, lineTotal } = lineTotals(l);
      subtotal += afterDisc;
      taxTotal += tax;
      execRun(
        `INSERT INTO purchase_order_lines (id, company_id, purchase_order_id, line_no, product_id, description, quantity, unit_price, discount_pct, tax_pct, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uid(),
          p._company_id,
          poId,
          i,
          l.product_id,
          l.description ?? null,
          Number(l.quantity),
          Number(l.unit_price),
          Number(l.discount_pct ?? 0) || 0,
          Number(l.tax_pct ?? 0) || 0,
          lineTotal,
        ],
      );
    }
    execRun(`UPDATE purchase_orders SET subtotal=?, tax_total=?, grand_total=? WHERE id=?`, [
      subtotal,
      taxTotal,
      subtotal + taxTotal,
      poId,
    ]);
    scheduleSave();
    return ok(poId);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

function create_goods_receipt(p: any): RpcResult {
  try {
    const lines = p._lines as any[];
    if (!lines?.length) throw new Error("GR must have at least one line");
    const poRows = execAll(`SELECT * FROM purchase_orders WHERE id=? AND company_id=?`, [
      p._purchase_order_id,
      p._company_id,
    ]);
    const po = poRows[0];
    if (!po) throw new Error("PO not found");
    if (po.status === "cancelled" || po.status === "closed")
      throw new Error("PO is closed/cancelled");

    const grNo = nextDocNo(p._company_id, "goods_receipt", "GR");
    const grId = uid();
    execRun(
      `INSERT INTO goods_receipts (id, company_id, gr_no, purchase_order_id, supplier_id, warehouse_id, supplier_ref, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        grId,
        p._company_id,
        grNo,
        p._purchase_order_id,
        po.supplier_id,
        po.warehouse_id,
        p._supplier_ref ?? null,
        p._notes ?? null,
        currentUserId(),
      ],
    );

    let total = 0;
    for (const l of lines) {
      if (Number(l.quantity) <= 0) continue;
      const movId = postStockMovement({
        companyId: p._company_id,
        warehouseId: po.warehouse_id,
        productId: l.product_id,
        movementType: "in",
        source: "purchase",
        quantity: Number(l.quantity),
        unitCost: Number(l.unit_cost ?? 0),
        movementDate: now(),
        sourceRef: grNo,
        notes: p._notes ?? null,
      });
      execRun(
        `INSERT INTO goods_receipt_lines (id, company_id, goods_receipt_id, purchase_order_line_id, product_id, quantity, unit_cost, movement_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uid(),
          p._company_id,
          grId,
          l.po_line_id || null,
          l.product_id,
          Number(l.quantity),
          Number(l.unit_cost ?? 0),
          movId,
        ],
      );
      total += Number(l.quantity) * Number(l.unit_cost ?? 0);
      if (l.po_line_id) {
        execRun(
          `UPDATE purchase_order_lines SET quantity_received = quantity_received + ? WHERE id=?`,
          [Number(l.quantity), l.po_line_id],
        );
      }
    }

    const polRows = execAll(
      `SELECT bool_and(quantity_received >= quantity) AS all_received FROM purchase_order_lines WHERE purchase_order_id=?`,
      [p._purchase_order_id],
    );
    const allRecv = polRows[0]?.all_received === 1 || polRows[0]?.all_received === true;
    execRun(`UPDATE purchase_orders SET status=? WHERE id=?`, [
      allRecv ? "received" : "partial",
      p._purchase_order_id,
    ]);

    // auto-JE Dr Persediaan (1300) / Cr Utang Usaha (2100)
    if (total > 0) {
      const invAcct = getAccountId(p._company_id, "1300");
      const apAcct = getAccountId(p._company_id, "2100");
      if (invAcct && apAcct) {
        postJeInternal(p._company_id, today(), `Goods Receipt ${grNo}`, "purchase", grNo, [
          { account_id: invAcct, debit: total, credit: 0, description: "Persediaan masuk" },
          { account_id: apAcct, debit: 0, credit: total, description: "Utang usaha ke supplier" },
        ]);
      }
    }
    scheduleSave();
    return ok(grId);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ---------- SALES ----------
function create_sales_order(p: any): RpcResult {
  try {
    const lines = p._lines as Line[];
    if (!lines?.length) throw new Error("SO must have at least one line");
    const soNo = nextDocNo(p._company_id, "sales_order", "SO");
    const soId = uid();
    execRun(
      `INSERT INTO sales_orders (id, company_id, so_no, customer_id, warehouse_id, order_date, expected_date, customer_ref, notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?)`,
      [
        soId,
        p._company_id,
        soNo,
        p._customer_id,
        p._warehouse_id,
        p._order_date,
        p._expected_date ?? null,
        p._customer_ref ?? null,
        p._notes ?? null,
        currentUserId(),
      ],
    );
    let subtotal = 0;
    let taxTotal = 0;
    let i = 0;
    for (const l of lines) {
      i++;
      const { afterDisc, tax, lineTotal } = lineTotals(l);
      subtotal += afterDisc;
      taxTotal += tax;
      execRun(
        `INSERT INTO sales_order_lines (id, company_id, sales_order_id, line_no, product_id, description, quantity, unit_price, discount_pct, tax_pct, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uid(),
          p._company_id,
          soId,
          i,
          l.product_id,
          l.description ?? null,
          Number(l.quantity),
          Number(l.unit_price),
          Number(l.discount_pct ?? 0) || 0,
          Number(l.tax_pct ?? 0) || 0,
          lineTotal,
        ],
      );
    }
    execRun(`UPDATE sales_orders SET subtotal=?, tax_total=?, grand_total=? WHERE id=?`, [
      subtotal,
      taxTotal,
      subtotal + taxTotal,
      soId,
    ]);
    scheduleSave();
    return ok(soId);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

function create_delivery_order(p: any): RpcResult {
  try {
    const lines = p._lines as any[];
    if (!lines?.length) throw new Error("DO must have at least one line");
    const soRows = execAll(`SELECT * FROM sales_orders WHERE id=? AND company_id=?`, [
      p._sales_order_id,
      p._company_id,
    ]);
    const so = soRows[0];
    if (!so) throw new Error("SO not found");
    if (so.status === "cancelled" || so.status === "closed")
      throw new Error("SO is closed/cancelled");

    const doNo = nextDocNo(p._company_id, "delivery_order", "DO");
    const doId = uid();
    execRun(
      `INSERT INTO delivery_orders (id, company_id, do_no, sales_order_id, customer_id, warehouse_id, carrier, tracking_no, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        doId,
        p._company_id,
        doNo,
        p._sales_order_id,
        so.customer_id,
        so.warehouse_id,
        p._carrier ?? null,
        p._tracking_no ?? null,
        p._notes ?? null,
        currentUserId(),
      ],
    );

    let cogsTotal = 0;
    for (const l of lines) {
      if (Number(l.quantity) <= 0) continue;
      const balRows = execAll(
        `SELECT average_cost FROM stock_balances WHERE company_id=? AND product_id=? AND warehouse_id=?`,
        [p._company_id, l.product_id, so.warehouse_id],
      );
      const avg = Number(balRows[0]?.average_cost ?? 0);
      const mov = postStockMovement({
        companyId: p._company_id,
        warehouseId: so.warehouse_id,
        productId: l.product_id,
        movementType: "out",
        source: "sales",
        quantity: Number(l.quantity),
        unitCost: avg,
        movementDate: now(),
        sourceRef: doNo,
        notes: p._notes ?? null,
      });
      cogsTotal += Number(l.quantity) * avg;
      execRun(
        `INSERT INTO delivery_order_lines (id, company_id, delivery_order_id, sales_order_line_id, product_id, quantity, movement_id)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uid(), p._company_id, doId, l.so_line_id || null, l.product_id, Number(l.quantity), mov],
      );
      if (l.so_line_id) {
        execRun(
          `UPDATE sales_order_lines SET quantity_delivered = quantity_delivered + ? WHERE id=?`,
          [Number(l.quantity), l.so_line_id],
        );
      }
    }

    const aggRows = execAll(
      `SELECT bool_and(quantity_delivered >= quantity) AS all_done, bool_or(quantity_delivered > 0) AS any_done FROM sales_order_lines WHERE sales_order_id=?`,
      [p._sales_order_id],
    );
    const allDone = aggRows[0]?.all_done === 1 || aggRows[0]?.all_done === true;
    const anyDone = aggRows[0]?.any_done === 1 || aggRows[0]?.any_done === true;
    if (allDone || anyDone) {
      execRun(`UPDATE sales_orders SET status=? WHERE id=?`, [
        allDone ? "delivered" : "partial",
        p._sales_order_id,
      ]);
    }

    // auto-JE Dr HPP (5100) / Cr Persediaan (1300)
    if (cogsTotal > 0) {
      const cogsAcct = getAccountId(p._company_id, "5100");
      const invAcct = getAccountId(p._company_id, "1300");
      if (cogsAcct && invAcct) {
        postJeInternal(p._company_id, today(), `HPP dari Delivery ${doNo}`, "sales", doNo, [
          { account_id: cogsAcct, debit: cogsTotal, credit: 0, description: "HPP penjualan" },
          { account_id: invAcct, debit: 0, credit: cogsTotal, description: "Persediaan keluar" },
        ]);
      }
    }
    scheduleSave();
    return ok(doId);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

function create_customer_invoice(p: any): RpcResult {
  try {
    const lines = p._lines as Line[];
    if (!lines?.length) throw new Error("Invoice must have at least one line");
    const soRows = execAll(`SELECT * FROM sales_orders WHERE id=? AND company_id=?`, [
      p._sales_order_id,
      p._company_id,
    ]);
    const so = soRows[0];
    if (!so) throw new Error("SO not found");

    const invNo = nextDocNo(p._company_id, "customer_invoice", "INV");
    const invId = uid();
    execRun(
      `INSERT INTO customer_invoices (id, company_id, invoice_no, sales_order_id, customer_id, invoice_date, due_date, notes, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'issued', ?)`,
      [
        invId,
        p._company_id,
        invNo,
        p._sales_order_id,
        so.customer_id,
        p._invoice_date,
        p._due_date ?? null,
        p._notes ?? null,
        currentUserId(),
      ],
    );

    let subtotal = 0;
    let taxTotal = 0;
    let i = 0;
    for (const l of lines) {
      if (Number(l.quantity) <= 0) continue;
      i++;
      const { afterDisc, tax, lineTotal } = lineTotals(l);
      subtotal += afterDisc;
      taxTotal += tax;
      execRun(
        `INSERT INTO customer_invoice_lines (id, company_id, invoice_id, sales_order_line_id, line_no, product_id, description, quantity, unit_price, discount_pct, tax_pct, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uid(),
          p._company_id,
          invId,
          (l as any).so_line_id || null,
          i,
          l.product_id,
          l.description ?? null,
          Number(l.quantity),
          Number(l.unit_price),
          Number(l.discount_pct ?? 0) || 0,
          Number(l.tax_pct ?? 0) || 0,
          lineTotal,
        ],
      );
      if ((l as any).so_line_id) {
        execRun(
          `UPDATE sales_order_lines SET quantity_invoiced = quantity_invoiced + ? WHERE id=?`,
          [Number(l.quantity), (l as any).so_line_id],
        );
      }
    }
    execRun(`UPDATE customer_invoices SET subtotal=?, tax_total=?, grand_total=? WHERE id=?`, [
      subtotal,
      taxTotal,
      subtotal + taxTotal,
      invId,
    ]);

    // auto-JE Dr Piutang (1200) / Cr Penjualan (4100) [+ Cr PPN Keluaran (2200)]
    const total = subtotal + taxTotal;
    if (total > 0) {
      const arAcct = getAccountId(p._company_id, "1200");
      const revAcct = getAccountId(p._company_id, "4100");
      const vatAcct = getAccountId(p._company_id, "2200");
      if (arAcct && revAcct) {
        const jeLines = [
          { account_id: arAcct, debit: total, credit: 0, description: "Piutang customer" },
          { account_id: revAcct, debit: 0, credit: subtotal, description: "Pendapatan penjualan" },
        ];
        if (taxTotal > 0 && vatAcct) {
          jeLines.push({
            account_id: vatAcct,
            debit: 0,
            credit: taxTotal,
            description: "PPN Keluaran",
          });
        }
        postJeInternal(p._company_id, p._invoice_date, `Invoice ${invNo}`, "sales", invNo, jeLines);
      }
    }
    scheduleSave();
    return ok(invId);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ---------- POS ----------
function create_pos_sale(p: any): RpcResult {
  try {
    const lines = p._lines as Line[];
    if (!lines?.length) throw new Error("POS sale must have at least one line");
    const customerId = p._customer_id ?? getOrCreateWalkinCustomer(p._company_id);

    const soId = create_sales_order({
      _company_id: p._company_id,
      _customer_id: customerId,
      _warehouse_id: p._warehouse_id,
      _order_date: p._sale_date,
      _expected_date: p._sale_date,
      _customer_ref: "POS",
      _notes: p._notes,
      _lines: lines,
    }).data;

    const solRows = execAll(
      `SELECT id, product_id, quantity, unit_price, discount_pct, tax_pct, description FROM sales_order_lines WHERE sales_order_id=? ORDER BY line_no`,
      [soId],
    );
    const doLines = solRows.map((r) => ({
      so_line_id: r.id,
      product_id: r.product_id,
      quantity: r.quantity,
    }));
    const invLines = solRows.map((r) => ({
      so_line_id: r.id,
      product_id: r.product_id,
      description: r.description,
      quantity: r.quantity,
      unit_price: r.unit_price,
      discount_pct: r.discount_pct,
      tax_pct: r.tax_pct,
    }));
    const doId = create_delivery_order({
      _company_id: p._company_id,
      _sales_order_id: soId,
      _carrier: "POS",
      _tracking_no: null,
      _notes: p._notes,
      _lines: doLines,
    }).data;
    const invId = create_customer_invoice({
      _company_id: p._company_id,
      _sales_order_id: soId,
      _invoice_date: p._sale_date,
      _due_date: p._sale_date,
      _notes: p._notes,
      _lines: invLines,
    }).data;

    const invRows = execAll(`SELECT * FROM customer_invoices WHERE id=?`, [invId]);
    const inv = invRows[0];

    let payNo: string | null = null;
    let payId: string | null = null;
    const amountPaid = Number(p._amount_paid ?? 0);
    if (amountPaid > 0) {
      const cashAcct = getAccountId(p._company_id, p._cash_account_code ?? "1100");
      const arAcct = getAccountId(p._company_id, "1200");
      payNo = nextDocNo(p._company_id, "pos_payment", "PAY");
      let jeId: string | null = null;
      if (cashAcct && arAcct) {
        jeId = postJeInternal(
          p._company_id,
          p._sale_date,
          `POS Payment ${payNo} for ${inv.invoice_no}`,
          "sales",
          payNo,
          [
            {
              account_id: cashAcct,
              debit: amountPaid,
              credit: 0,
              description: "Penerimaan kas POS",
            },
            { account_id: arAcct, debit: 0, credit: amountPaid, description: "Pelunasan piutang" },
          ],
        );
      }
      payId = uid();
      execRun(
        `INSERT INTO pos_payments (id, company_id, invoice_id, payment_no, method, amount, reference, cash_account_id, journal_entry_id, paid_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          payId,
          p._company_id,
          invId,
          payNo,
          p._payment_method ?? "cash",
          amountPaid,
          p._payment_reference ?? null,
          cashAcct,
          jeId,
          now(),
          currentUserId(),
        ],
      );
      const newPaid = Number(inv.amount_paid ?? 0) + amountPaid;
      const status = newPaid >= Number(inv.grand_total) ? "paid" : inv.status;
      execRun(`UPDATE customer_invoices SET amount_paid=?, status=? WHERE id=?`, [
        newPaid,
        status,
        invId,
      ]);
    }

    execRun(`UPDATE sales_orders SET status='closed' WHERE id=?`, [soId]);
    scheduleSave();
    return ok({
      sales_order_id: soId,
      delivery_order_id: doId,
      invoice_id: invId,
      invoice_no: inv.invoice_no,
      grand_total: Number(inv.grand_total),
      amount_paid: amountPaid,
      change: Math.max(amountPaid - Number(inv.grand_total), 0),
      payment_id: payId,
      payment_no: payNo,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ---------- ACCOUNTING ----------
function post_journal_entry(p: any): RpcResult {
  try {
    const lines = p._lines as any[];
    if (!lines || lines.length < 2) throw new Error("Journal must have at least 2 lines");
    let totalDebit = 0;
    let totalCredit = 0;
    for (const l of lines) {
      const d = Number(l.debit ?? 0);
      const c = Number(l.credit ?? 0);
      if (d > 0 && c > 0) throw new Error("Line has both debit and credit");
      totalDebit += d;
      totalCredit += c;
    }
    if (totalDebit !== totalCredit)
      throw new Error(`Journal not balanced: debit ${totalDebit}, credit ${totalCredit}`);
    if (totalDebit === 0) throw new Error("Journal has zero total");
    const id = postJeInternal(
      p._company_id,
      p._entry_date,
      p._memo ?? null,
      p._source ?? "manual",
      p._source_ref ?? null,
      lines,
    );
    return ok(id);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ---------- MANUFACTURING ----------
function calc_material_requirements(p: any): RpcResult {
  try {
    const bomRows = execAll(
      `SELECT output_quantity FROM bills_of_materials WHERE id=? AND company_id=?`,
      [p._bom_id, p._company_id],
    );
    const output = Number(bomRows[0]?.output_quantity ?? 0);
    if (!output) throw new Error("BOM not found or output qty zero");
    const compRows = execAll(
      `SELECT bc.component_product_id, bc.quantity, bc.waste_pct, p.sku, p.name
       FROM bom_components bc JOIN products p ON p.id = bc.component_product_id
       WHERE bc.bom_id=? AND bc.company_id=? ORDER BY p.name`,
      [p._bom_id, p._company_id],
    );
    const data = compRows.map((r) => {
      const required =
        (Number(r.quantity) * (1 + Number(r.waste_pct) / 100) * Number(p._target_qty)) / output;
      const onHandRows = execAll(
        `SELECT quantity_on_hand FROM stock_balances WHERE company_id=? AND product_id=? AND warehouse_id=?`,
        [p._company_id, r.component_product_id, p._warehouse_id],
      );
      const onHand = Number(onHandRows[0]?.quantity_on_hand ?? 0);
      return {
        component_product_id: r.component_product_id,
        sku: r.sku,
        name: r.name,
        required_qty: Math.round(required * 10000) / 10000,
        on_hand: onHand,
        shortage: Math.max(0, Math.round(required * 10000) / 10000 - onHand),
      };
    });
    return ok(data);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

function create_work_order(p: any): RpcResult {
  try {
    const bomRows = execAll(`SELECT * FROM bills_of_materials WHERE id=? AND company_id=?`, [
      p._bom_id,
      p._company_id,
    ]);
    const bom = bomRows[0];
    if (!bom) throw new Error("BOM not found");
    if (!Number(bom.output_quantity)) throw new Error("BOM output qty invalid");

    const woNo = nextDocNo(p._company_id, "work_order", "WO");
    const woId = uid();
    execRun(
      `INSERT INTO work_orders (id, company_id, wo_no, bom_id, product_id, warehouse_id, planned_qty, planned_start, planned_end, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        woId,
        p._company_id,
        woNo,
        p._bom_id,
        bom.product_id,
        p._warehouse_id,
        Number(p._planned_qty),
        p._planned_start ?? null,
        p._planned_end ?? null,
        p._notes ?? null,
        currentUserId(),
      ],
    );
    const compRows = execAll(
      `SELECT component_product_id, quantity, waste_pct FROM bom_components WHERE bom_id=? AND company_id=?`,
      [p._bom_id, p._company_id],
    );
    for (const c of compRows) {
      const planned =
        (Number(c.quantity) * (1 + Number(c.waste_pct) / 100) * Number(p._planned_qty)) /
        Number(bom.output_quantity);
      execRun(
        `INSERT INTO work_order_components (id, company_id, work_order_id, component_product_id, planned_qty) VALUES (?, ?, ?, ?, ?)`,
        [uid(), p._company_id, woId, c.component_product_id, Math.round(planned * 10000) / 10000],
      );
    }
    scheduleSave();
    return ok(woId);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

function set_work_order_status(p: any): RpcResult {
  try {
    const rows = execAll(`SELECT status FROM work_orders WHERE id=? AND company_id=?`, [
      p._wo_id,
      p._company_id,
    ]);
    if (!rows[0]) throw new Error("WO not found");
    if (rows[0].status === "completed" || rows[0].status === "cancelled")
      throw new Error("WO already finalized");
    if (p._status === "released" || p._status === "in_progress") {
      execRun(
        `UPDATE work_orders SET status=?, actual_start=COALESCE(actual_start, ?) WHERE id=?`,
        [p._status, now(), p._wo_id],
      );
    } else {
      execRun(`UPDATE work_orders SET status=? WHERE id=?`, [p._status, p._wo_id]);
    }
    scheduleSave();
    return ok(null);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

function complete_work_order(p: any): RpcResult {
  try {
    if (Number(p._produced_qty) <= 0) throw new Error("Produced qty must be > 0");
    const woRows = execAll(`SELECT * FROM work_orders WHERE id=? AND company_id=?`, [
      p._wo_id,
      p._company_id,
    ]);
    const wo = woRows[0];
    if (!wo) throw new Error("WO not found");
    if (wo.status === "completed" || wo.status === "cancelled")
      throw new Error("WO already finalized");

    let totalCost = 0;
    const compRows = execAll(`SELECT * FROM work_order_components WHERE work_order_id=?`, [
      p._wo_id,
    ]);
    for (const c of compRows) {
      const balRows = execAll(
        `SELECT average_cost FROM stock_balances WHERE company_id=? AND product_id=? AND warehouse_id=?`,
        [p._company_id, c.component_product_id, wo.warehouse_id],
      );
      const avg = Number(balRows[0]?.average_cost ?? 0);
      const mov = postStockMovement({
        companyId: p._company_id,
        warehouseId: wo.warehouse_id,
        productId: c.component_product_id,
        movementType: "out",
        source: "production",
        quantity: Number(c.planned_qty),
        unitCost: avg,
        movementDate: now(),
        sourceRef: wo.wo_no,
        notes: p._notes ?? "Material consumption",
      });
      execRun(
        `UPDATE work_order_components SET consumed_qty=?, unit_cost=?, movement_id=? WHERE id=?`,
        [Number(c.planned_qty), avg, mov, c.id],
      );
      totalCost += Number(c.planned_qty) * avg;
    }
    const unitCost = Number(p._produced_qty) > 0 ? totalCost / Number(p._produced_qty) : 0;
    const fgMov = postStockMovement({
      companyId: p._company_id,
      warehouseId: wo.warehouse_id,
      productId: wo.product_id,
      movementType: "in",
      source: "production",
      quantity: Number(p._produced_qty),
      unitCost,
      movementDate: now(),
      sourceRef: wo.wo_no,
      notes: p._notes ?? "Finished goods produced",
    });
    execRun(`UPDATE work_orders SET status='completed', produced_qty=?, actual_end=? WHERE id=?`, [
      Number(p._produced_qty),
      now(),
      p._wo_id,
    ]);
    scheduleSave();
    return ok({
      work_order_id: p._wo_id,
      total_material_cost: totalCost,
      unit_cost: unitCost,
      finished_movement_id: fgMov,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ---------- CRM ----------
function convert_lead(p: any): RpcResult {
  try {
    const leadRows = execAll(`SELECT * FROM leads WHERE id=? AND company_id=?`, [
      p._lead_id,
      p._company_id,
    ]);
    const lead = leadRows[0];
    if (!lead) throw new Error("Lead not found");
    if (lead.status === "converted") throw new Error("Lead already converted");
    const code =
      p._customer_code || `CUST-${new Date().toISOString().slice(2, 19).replace(/[-T:]/g, "")}`;
    const custId = uid();
    execRun(
      `INSERT INTO customers (id, company_id, code, name, email, phone, is_active, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?)`,
      [
        custId,
        p._company_id,
        code,
        lead.company_name ?? lead.name,
        lead.email ?? null,
        lead.phone ?? null,
        currentUserId(),
      ],
    );
    let oppId: string | null = null;
    if (p._create_opportunity) {
      oppId = uid();
      execRun(
        `INSERT INTO opportunities (id, company_id, name, customer_id, lead_id, stage, amount, assigned_to, created_by)
         VALUES (?, ?, ?, ?, ?, 'qualification', ?, ?, ?)`,
        [
          oppId,
          p._company_id,
          `${lead.name} Opportunity`,
          custId,
          p._lead_id,
          Number(lead.estimated_value ?? 0),
          lead.assigned_to ?? null,
          currentUserId(),
        ],
      );
    }
    execRun(`UPDATE leads SET status='converted', converted_customer_id=? WHERE id=?`, [
      custId,
      p._lead_id,
    ]);
    scheduleSave();
    return ok({ customer_id: custId, opportunity_id: oppId });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ---------- HR / PAYROLL ----------
function create_payroll_run(p: any): RpcResult {
  try {
    const runNo = nextDocNo(p._company_id, "payroll_run", "PR");
    const runId = uid();
    execRun(
      `INSERT INTO payroll_runs (id, company_id, run_no, period_year, period_month, pay_date, notes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        runId,
        p._company_id,
        runNo,
        Number(p._period_year),
        Number(p._period_month),
        p._pay_date,
        p._notes ?? null,
        currentUserId(),
      ],
    );
    const empRows = execAll(
      `SELECT id, base_salary, allowance_fixed FROM employees WHERE company_id=? AND employment_status='active'`,
      [p._company_id],
    );
    let totalGross = 0;
    let totalNet = 0;
    for (const e of empRows) {
      const gross = Number(e.base_salary ?? 0) + Number(e.allowance_fixed ?? 0);
      const net = gross;
      execRun(
        `INSERT INTO payroll_lines (id, company_id, payroll_run_id, employee_id, base_salary, allowance, gross_pay, deduction, net_pay)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [
          uid(),
          p._company_id,
          runId,
          e.id,
          Number(e.base_salary ?? 0),
          Number(e.allowance_fixed ?? 0),
          gross,
          net,
        ],
      );
      totalGross += gross;
      totalNet += net;
    }
    execRun(`UPDATE payroll_runs SET total_gross=?, total_deductions=0, total_net=? WHERE id=?`, [
      totalGross,
      totalNet,
      runId,
    ]);
    scheduleSave();
    return ok(runId);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

function post_payroll_run(p: any): RpcResult {
  try {
    const runRows = execAll(`SELECT * FROM payroll_runs WHERE id=? AND company_id=?`, [
      p._run_id,
      p._company_id,
    ]);
    const run = runRows[0];
    if (!run) throw new Error("Payroll run not found");
    if (run.status === "posted" || run.status === "paid") throw new Error("Payroll already posted");

    const taxRows = execAll(
      `SELECT COALESCE(SUM(tax),0) AS t FROM payroll_lines WHERE payroll_run_id=?`,
      [p._run_id],
    );
    const totalTax = Number(taxRows[0]?.t ?? 0);

    const expAcct = getAccountId(p._company_id, "6100");
    const creditAcct = getAccountId(p._company_id, p._cash_account_code ?? "1100");
    const taxAcct = getAccountId(p._company_id, "2410");
    if (!expAcct || !creditAcct) throw new Error("Required accounts missing");

    const jeLines = [
      {
        account_id: expAcct,
        debit: Number(run.total_gross),
        credit: 0,
        description: `Beban gaji ${run.run_no}`,
      },
      {
        account_id: creditAcct,
        debit: 0,
        credit: Number(run.total_net),
        description: `Pembayaran gaji ${run.run_no}`,
      },
    ];
    if (totalTax > 0 && taxAcct) {
      jeLines.push({
        account_id: taxAcct,
        debit: 0,
        credit: totalTax,
        description: "PPh 21 terutang",
      });
    }
    const jeId = postJeInternal(
      p._company_id,
      run.pay_date,
      `Payroll ${run.run_no}`,
      "manual",
      run.run_no,
      jeLines,
    );
    execRun(`UPDATE payroll_runs SET status=?, journal_entry_id=? WHERE id=?`, [
      p._mark_paid ? "paid" : "posted",
      jeId,
      p._run_id,
    ]);
    scheduleSave();
    return ok(jeId);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

const HANDLERS: Record<string, (p: any) => RpcResult> = {
  post_stock_movement,
  post_stock_transfer,
  post_stock_adjustment,
  create_purchase_order,
  create_goods_receipt,
  create_sales_order,
  create_delivery_order,
  create_customer_invoice,
  create_pos_sale,
  post_journal_entry,
  calc_material_requirements,
  create_work_order,
  set_work_order_status,
  complete_work_order,
  convert_lead,
  create_payroll_run,
  post_payroll_run,
};

export async function rpc(name: string, params: any): Promise<RpcResult> {
  if (typeof window === "undefined") {
    return { data: null, error: { message: "RPC unavailable during SSR" } };
  }
  const { initDb } = await import("./engine");
  await initDb();
  const handler = HANDLERS[name];
  if (!handler) return err(`Unknown RPC: ${name}`);
  return handler(params ?? {});
}
