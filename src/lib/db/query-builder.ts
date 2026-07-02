import { getDb } from "./engine";
import { scheduleSave } from "./engine";
import { resolveRelation } from "./relations";

// Columns stored as INTEGER 0/1 that should surface as JS booleans.
const BOOLEAN_COLUMNS = new Set([
  "is_active",
  "is_default",
  "allow_negative_stock",
  "track_batch",
  "track_serial",
  "is_purchase_default",
  "is_sale_default",
  "is_group",
]);

export type QueryResult<T = any> = {
  data: T;
  error: { message: string; code?: string } | null;
  count: number | null;
  status: number;
  statusText: string;
};

type SelectNode =
  | { kind: "column"; name: string }
  | { kind: "resource"; table: string; fkHint?: string; inner?: boolean; children: SelectNode[] };

type Filter = { kind: "eq" | "neq" | "in" | "is" | "or"; payload: any };

function parseSelect(selectStr: string): SelectNode[] {
  const nodes: SelectNode[] = [];
  let i = 0;
  const s = selectStr.trim();
  while (i < s.length) {
    while (i < s.length && s[i] === " ") i++;
    if (i >= s.length) break;
    // read token until ',' or '(' at top level
    let token = "";
    while (i < s.length && s[i] !== "," && s[i] !== "(") {
      token += s[i];
      i++;
    }
    token = token.trim();
    if (i < s.length && s[i] === "(") {
      // resource: table!hint?(children)
      let table = token;
      let fkHint: string | undefined;
      let inner = false;
      const bang = table.indexOf("!");
      if (bang >= 0) {
        const hint = table.slice(bang + 1);
        table = table.slice(0, bang);
        if (hint === "inner" || hint === "left") inner = hint === "inner";
        else fkHint = hint;
      }
      i++; // consume '('
      // read until matching ')'
      let depth = 1;
      let innerStr = "";
      while (i < s.length && depth > 0) {
        if (s[i] === "(") depth++;
        else if (s[i] === ")") {
          depth--;
          if (depth === 0) break;
        }
        innerStr += s[i];
        i++;
      }
      i++; // consume ')'
      nodes.push({
        kind: "resource",
        table,
        fkHint,
        inner,
        children: parseSelect(innerStr),
      });
    } else if (token) {
      // strip alias "col:alias" -> keep col
      const colon = token.indexOf(":");
      if (colon >= 0) token = token.slice(0, colon);
      nodes.push({ kind: "column", name: token });
    }
    // skip comma
    while (i < s.length && (s[i] === "," || s[i] === " ")) i++;
  }
  return nodes;
}

function coerceValue(v: unknown): unknown {
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v === undefined) return null;
  if (v !== null && typeof v === "object") return JSON.stringify(v);
  return v;
}

function hydrateRow(row: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== null && typeof v === "number" && (v === 0 || v === 1) && BOOLEAN_COLUMNS.has(k)) {
      out[k] = v === 1;
    } else {
      out[k] = v;
    }
  }
  return out;
}

function execAll(sql: string, params: any[] = []): Record<string, any>[] {
  const db = getDb();
  const stmt = db.prepare(sql);
  try {
    stmt.bind(params);
    const rows: Record<string, any>[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as Record<string, any>);
    }
    return rows;
  } finally {
    stmt.free();
  }
}

function execRun(sql: string, params: any[] = []): { changes: number } {
  const db = getDb();
  db.run(sql, params);
  return { changes: db.getRowsModified() };
}

function quoteIdent(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"';
}

function buildWhere(table: string, filters: Filter[]): { sql: string; params: any[] } {
  const parts: string[] = [];
  const params: any[] = [];
  for (const f of filters) {
    if (f.kind === "eq") {
      parts.push(`${quoteIdent(f.payload.col)} = ?`);
      params.push(coerceValue(f.payload.val));
    } else if (f.kind === "neq") {
      parts.push(`${quoteIdent(f.payload.col)} != ?`);
      params.push(coerceValue(f.payload.val));
    } else if (f.kind === "in") {
      const vals = f.payload.val as any[];
      if (!vals.length) {
        parts.push("0");
      } else {
        parts.push(`${quoteIdent(f.payload.col)} IN (${vals.map(() => "?").join(",")})`);
        params.push(...vals.map(coerceValue));
      }
    } else if (f.kind === "is") {
      if (f.payload.val === null) parts.push(`${quoteIdent(f.payload.col)} IS NULL`);
      else parts.push(`${quoteIdent(f.payload.col)} IS NOT NULL`);
    } else if (f.kind === "or") {
      // payload = raw PostgREST string like "a.op.val,b.op.val2"
      const groups = String(f.payload)
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean);
      const orParts: string[] = [];
      for (const g of groups) {
        const m = g.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\.([a-z]+)\.(.*)$/);
        if (!m) continue;
        const [, col, op, raw] = m;
        const val = raw.replace(/^%/, "").replace(/%$/, "");
        switch (op) {
          case "eq":
            orParts.push(`${quoteIdent(col)} = ?`);
            params.push(val);
            break;
          case "neq":
            orParts.push(`${quoteIdent(col)} != ?`);
            params.push(val);
            break;
          case "gt":
            orParts.push(`${quoteIdent(col)} > ?`);
            params.push(Number(val));
            break;
          case "lt":
            orParts.push(`${quoteIdent(col)} < ?`);
            params.push(Number(val));
            break;
          case "gte":
            orParts.push(`${quoteIdent(col)} >= ?`);
            params.push(Number(val));
            break;
          case "lte":
            orParts.push(`${quoteIdent(col)} <= ?`);
            params.push(Number(val));
            break;
          case "like":
          case "ilike":
            orParts.push(`${quoteIdent(col)} LIKE ?`);
            params.push(`%${val}%`);
            break;
          case "is":
            if (val === "null" || val === "") orParts.push(`${quoteIdent(col)} IS NULL`);
            else orParts.push(`${quoteIdent(col)} IS NOT NULL`);
            break;
          default:
            break;
        }
      }
      if (orParts.length) parts.push("(" + orParts.join(" OR ") + ")");
    }
  }
  const sql = parts.length ? `WHERE ${parts.join(" AND ")}` : "";
  return { sql, params };
}

async function attachEmbeddings(
  parentTable: string,
  rows: Record<string, any>[],
  nodes: SelectNode[],
): Promise<void> {
  for (const node of nodes) {
    if (node.kind !== "resource") continue;
    const rel = resolveRelation(parentTable, node.table, node.fkHint);
    if (!rel) continue;

    if (rel.cardinality === "to-one") {
      const col = rel.fk.column;
      const ids = [
        ...new Set(rows.map((r) => r[col]).filter((v) => v !== null && v !== undefined)),
      ];
      let children: Record<string, any>[] = [];
      if (ids.length) {
        const ph = ids.map(() => "?").join(",");
        children = execAll(
          `SELECT * FROM ${quoteIdent(node.table)} WHERE ${quoteIdent(rel.fk.refColumn)} IN (${ph})`,
          ids,
        );
      }
      const map = new Map<string, Record<string, any>>();
      for (const c of children) map.set(c[rel.fk.refColumn], hydrateRow(c));
      if (node.children.length) {
        await attachEmbeddings(node.table, children, node.children);
      }
      for (const r of rows) {
        r[node.table] = r[col] != null ? (map.get(r[col]) ?? null) : null;
      }
    } else {
      // to-many: child.fk.column -> parent.id
      const parentIds = rows.map((r) => r[rel.fk.refColumn]);
      let children: Record<string, any>[] = [];
      if (parentIds.length) {
        const ph = parentIds.map(() => "?").join(",");
        children = execAll(
          `SELECT * FROM ${quoteIdent(node.table)} WHERE ${quoteIdent(rel.fk.column)} IN (${ph})`,
          parentIds,
        );
      }
      if (node.children.length) {
        await attachEmbeddings(node.table, children, node.children);
      }
      const grouped = new Map<string, Record<string, any>[]>();
      for (const c of children) {
        const key = c[rel.fk.column];
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(hydrateRow(c));
      }
      for (const r of rows) {
        r[node.table] = grouped.get(r[rel.fk.refColumn]) ?? [];
      }
    }
  }
}

export class QueryBuilder<T = any, DataT = T[] | null> implements PromiseLike<QueryResult<DataT>> {
  private table: string;
  private op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private selectNodes: SelectNode[] = [{ kind: "column", name: "*" }];
  private filters: Filter[] = [];
  private orderClauses: { col: string; asc: boolean }[] = [];
  private limitN: number | null = null;
  private payload: any = null;
  private countMode: "exact" | null = null;
  private head = false;
  private singleMode: "single" | "maybeSingle" | null = null;
  private onConflict: string | null = null;

  constructor(table: string) {
    this.table = table;
  }

  select(columns?: string, opts?: { count?: "exact"; head?: boolean }): QueryBuilder<T, T[]> {
    this.op = "select";
    this.selectNodes = parseSelect(columns ?? "*");
    if (opts?.count) this.countMode = opts.count;
    if (opts?.head) this.head = true;
    return this as unknown as QueryBuilder<T, T[]>;
  }

  eq(col: string, val: any): this {
    this.filters.push({ kind: "eq", payload: { col, val } });
    return this;
  }
  neq(col: string, val: any): this {
    this.filters.push({ kind: "neq", payload: { col, val } });
    return this;
  }
  in(col: string, vals: any[]): this {
    this.filters.push({ kind: "in", payload: { col, val: vals } });
    return this;
  }
  is(col: string, val: any): this {
    this.filters.push({ kind: "is", payload: { col, val } });
    return this;
  }
  or(filter: string): this {
    this.filters.push({ kind: "or", payload: filter });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean; nullsFirst?: boolean }): this {
    this.orderClauses.push({ col, asc: opts?.ascending ?? true });
    return this;
  }
  limit(n: number): this {
    this.limitN = n;
    return this;
  }
  single(): QueryBuilder<T, T | null> {
    this.singleMode = "single";
    return this as unknown as QueryBuilder<T, T | null>;
  }
  maybeSingle(): QueryBuilder<T, T | null> {
    this.singleMode = "maybeSingle";
    return this as unknown as QueryBuilder<T, T | null>;
  }
  insert(row: any): QueryBuilder<T, null> {
    this.op = "insert";
    this.payload = row;
    return this as unknown as QueryBuilder<T, null>;
  }
  update(row: any): QueryBuilder<T, null> {
    this.op = "update";
    this.payload = row;
    return this as unknown as QueryBuilder<T, null>;
  }
  upsert(row: any, opts?: { onConflict?: string }): QueryBuilder<T, null> {
    this.op = "upsert";
    this.payload = row;
    this.onConflict = opts?.onConflict ?? null;
    return this as unknown as QueryBuilder<T, null>;
  }
  delete(opts?: { count?: "exact" }): QueryBuilder<T, null> {
    this.op = "delete";
    if (opts?.count) this.countMode = opts.count;
    return this as unknown as QueryBuilder<T, null>;
  }

  private async execute(): Promise<QueryResult<DataT>> {
    const ready = await ensureDb();
    if (!ready) {
      // SSR / non-browser: return an empty shell so server rendering does not crash.
      return {
        data: (this.singleMode ? null : []) as DataT,
        error: null,
        count: null,
        status: 200,
        statusText: "",
      };
    }
    try {
      if (this.op === "select") return (await this.runSelect()) as QueryResult<DataT>;
      if (this.op === "insert") return this.runInsert() as QueryResult<DataT>;
      if (this.op === "update") return this.runUpdate() as QueryResult<DataT>;
      if (this.op === "upsert") return this.runUpsert() as QueryResult<DataT>;
      if (this.op === "delete") return this.runDelete() as QueryResult<DataT>;
      throw new Error("Unknown operation");
    } catch (err) {
      return {
        data: null as DataT,
        error: { message: err instanceof Error ? err.message : String(err) },
        count: null,
        status: 400,
        statusText: "",
      };
    }
  }

  private async runSelect(): Promise<QueryResult<any>> {
    if (this.head || this.countMode) {
      const { sql, params } = buildWhere(this.table, this.filters);
      const rows = execAll(`SELECT COUNT(*) AS c FROM ${quoteIdent(this.table)} ${sql}`, params);
      const count = Number(rows[0]?.c ?? 0);
      return {
        data: this.head ? null : [],
        error: null,
        count,
        status: 200,
        statusText: "",
      };
    }
    const { sql: whereSql, params } = buildWhere(this.table, this.filters);
    let sql = `SELECT * FROM ${quoteIdent(this.table)} ${whereSql}`;
    if (this.orderClauses.length) {
      sql +=
        " ORDER BY " +
        this.orderClauses.map((o) => `${quoteIdent(o.col)} ${o.asc ? "ASC" : "DESC"}`).join(", ");
    }
    if (this.limitN != null) sql += ` LIMIT ${Number(this.limitN)}`;
    const raw = execAll(sql, params);
    const rows = raw.map(hydrateRow);
    await attachEmbeddings(this.table, rows, this.selectNodes);

    if (this.singleMode === "single") {
      if (rows.length === 0) {
        return {
          data: null,
          error: { message: "no rows", code: "PGRST116" },
          count: null,
          status: 406,
          statusText: "",
        };
      }
      return { data: rows[0] as T, error: null, count: null, status: 200, statusText: "" };
    }
    if (this.singleMode === "maybeSingle") {
      return {
        data: (rows[0] ?? null) as T | null,
        error: null,
        count: null,
        status: 200,
        statusText: "",
      };
    }
    return { data: rows as T[], error: null, count: null, status: 200, statusText: "" };
  }

  private runInsert(): QueryResult<any> {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
    for (const row of rows) {
      const cols = Object.keys(row).filter((k) => row[k] !== undefined);
      const vals = cols.map((c) => coerceValue(row[c]));
      const ph = cols.map(() => "?").join(",");
      execRun(
        `INSERT INTO ${quoteIdent(this.table)} (${cols.map(quoteIdent).join(",")}) VALUES (${ph})`,
        vals,
      );
    }
    scheduleSave();
    const data = rows.length === 1 ? (rows[0] as T) : (rows as T);
    return { data, error: null, count: null, status: 201, statusText: "" };
  }

  private runUpdate(): QueryResult<any> {
    const sets = Object.keys(this.payload).filter((k) => this.payload[k] !== undefined);
    if (!sets.length) {
      return { data: null, error: null, count: null, status: 204, statusText: "" };
    }
    const setSql = sets.map((c) => `${quoteIdent(c)} = ?`).join(", ");
    const params = sets.map((c) => coerceValue(this.payload[c]));
    const { sql: whereSql, params: whereParams } = buildWhere(this.table, this.filters);
    execRun(`UPDATE ${quoteIdent(this.table)} SET ${setSql} ${whereSql}`, [
      ...params,
      ...whereParams,
    ]);
    scheduleSave();
    return { data: null, error: null, count: null, status: 204, statusText: "" };
  }

  private runUpsert(): QueryResult<any> {
    const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
    for (const row of rows) {
      const cols = Object.keys(row).filter((k) => row[k] !== undefined);
      const vals = cols.map((c) => coerceValue(row[c]));
      const ph = cols.map(() => "?").join(",");
      const conflictCol = this.onConflict ?? cols[0];
      const updateCols = cols.filter((c) => c !== conflictCol);
      let sql = `INSERT INTO ${quoteIdent(this.table)} (${cols.map(quoteIdent).join(",")}) VALUES (${ph})`;
      if (updateCols.length) {
        sql +=
          ` ON CONFLICT(${quoteIdent(conflictCol)}) DO UPDATE SET ` +
          updateCols.map((c) => `${quoteIdent(c)} = excluded.${quoteIdent(c)}`).join(", ");
      } else {
        sql += ` ON CONFLICT(${quoteIdent(conflictCol)}) DO NOTHING`;
      }
      execRun(sql, vals);
    }
    scheduleSave();
    const data = rows.length === 1 ? (rows[0] as T) : (rows as T);
    return { data, error: null, count: null, status: 201, statusText: "" };
  }

  private runDelete(): QueryResult<any> {
    const { sql: whereSql, params } = buildWhere(this.table, this.filters);
    execRun(`DELETE FROM ${quoteIdent(this.table)} ${whereSql}`, params);
    scheduleSave();
    return { data: null, error: null, count: null, status: 204, statusText: "" };
  }

  then<TResult1 = QueryResult<DataT>, TResult2 = never>(
    onfulfilled?: (v: QueryResult<DataT>) => TResult1 | PromiseLike<TResult1>,
    onrejected?: (e: any) => TResult2 | PromiseLike<TResult2>,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

let dbReady: Promise<boolean> | undefined;
function ensureDb(): Promise<boolean> {
  if (!dbReady) {
    dbReady = (async () => {
      if (typeof window === "undefined") return false;
      await import("./engine").then((m) => m.initDb());
      return true;
    })();
  }
  return dbReady;
}
