import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { SCHEMA_SQL } from "./schema";

const DB_NAME = "axon-erp-sqlite";
const STORE = "kv";
const KEY = "database";

let SQL: SqlJsStatic | undefined;
let db: Database | undefined;
let ready: Promise<Database> | undefined;

const idb = {
  open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },
  async get(key: string): Promise<Uint8Array | undefined> {
    const d = await this.open();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, "readonly");
      const r = tx.objectStore(STORE).get(key);
      r.onsuccess = () => resolve((r.result as Uint8Array) ?? undefined);
      r.onerror = () => reject(r.error);
    });
  },
  async set(key: string, value: Uint8Array): Promise<void> {
    const d = await this.open();
    return new Promise((resolve, reject) => {
      const tx = d.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

let saveTimer: ReturnType<typeof setTimeout> | undefined;

export function scheduleSave() {
  if (!db) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    if (!db) return;
    const data = db.export();
    await idb.set(KEY, data);
  }, 150);
}

export async function saveNow() {
  if (!db) return;
  const data = db.export();
  await idb.set(KEY, data);
}

export function getDb(): Database {
  if (!db) throw new Error("Database not initialized. Await initDb() first.");
  return db;
}

export function initDb(): Promise<Database> {
  if (ready) return ready;
  ready = (async () => {
    if (typeof window === "undefined") {
      throw new Error("SQLite client runs in the browser only.");
    }
    if (!SQL) SQL = await initSqlJs({ locateFile: () => wasmUrl });
    const existing = await idb.get(KEY);
    db = existing ? new SQL.Database(existing) : new SQL.Database();
    db.exec(SCHEMA_SQL);
    const { seedIfEmpty } = await import("./seed");
    await seedIfEmpty(db);
    return db;
  })();
  return ready;
}
