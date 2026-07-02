import { getDb } from "./engine";
import { scheduleSave } from "./engine";
import { uid, now, currentUserId, setCurrentUserId } from "./helpers";

const SESSION_KEY = "axon-auth-session";

type AuthUser = {
  id: string;
  email: string;
  user_metadata?: Record<string, any>;
};

type Session = {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
  expires_at?: number;
};

type Listener = (event: string, session: Session | null) => void;
const listeners = new Set<Listener>();

function emit(event: string, session: Session | null) {
  listeners.forEach((l) => l(event, session));
}

// ---------- crypto ----------
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const SUBTLE = globalThis.crypto?.subtle;

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(globalThis.crypto.getRandomValues(new Uint8Array(16)));
  const key = await SUBTLE!.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await SUBTLE!.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 100000, hash: "SHA-256" },
    key,
    256,
  );
  return bytesToBase64(salt) + ":" + bytesToBase64(new Uint8Array(bits));
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(":");
  if (!saltB64 || !hashB64) return false;
  const salt = base64ToBytes(saltB64);
  const key = await SUBTLE!.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"],
  );
  const bits = await SUBTLE!.deriveBits(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: 100000, hash: "SHA-256" },
    key,
    256,
  );
  return bytesToBase64(new Uint8Array(bits)) === hashB64;
}

// ---------- db helpers ----------
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

// ---------- session ----------
function loadSession(): Session | null {
  if (typeof localStorage === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}
function saveSession(session: Session | null) {
  if (typeof localStorage === "undefined") return;
  if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else localStorage.removeItem(SESSION_KEY);
}

function userById(id: string): AuthUser | null {
  const rows = execAll(`SELECT id, email FROM auth_users WHERE id = ?`, [id]);
  if (!rows[0]) return null;
  return { id: rows[0].id, email: rows[0].email };
}

// ---------- public API ----------
export const auth = {
  async getSession(): Promise<{ data: { session: Session | null } }> {
    if (typeof window === "undefined") return { data: { session: null } };
    const { initDb } = await import("./engine");
    await initDb();
    const session = loadSession();
    if (session?.user) setCurrentUserId(session.user.id);
    else setCurrentUserId(null);
    return { data: { session } };
  },

  async getUser(): Promise<{ data: { user: AuthUser | null }; error: { message: string } | null }> {
    if (typeof window === "undefined") return { data: { user: null }, error: null };
    const { initDb } = await import("./engine");
    await initDb();
    const session = loadSession();
    if (!session?.user) return { data: { user: null }, error: null };
    const user = userById(session.user.id);
    if (!user) return { data: { user: null }, error: { message: "user not found" } };
    setCurrentUserId(user.id);
    return { data: { user }, error: null };
  },

  async signUp(args: {
    email: string;
    password: string;
    options?: { data?: Record<string, any>; emailRedirectTo?: string };
  }): Promise<{ data: { user: AuthUser | null }; error: { message: string } | null }> {
    const { initDb } = await import("./engine");
    await initDb();
    const email = args.email.trim().toLowerCase();
    const existing = execAll(`SELECT id FROM auth_users WHERE email = ?`, [email]);
    if (existing[0]) return { data: { user: null }, error: { message: "User already registered" } };
    const hash = await hashPassword(args.password);
    const userId = uid();
    execRun(`INSERT INTO auth_users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)`, [
      userId,
      email,
      hash,
      now(),
    ]);
    const meta = args.options?.data ?? {};
    await provisionNewUser(userId, email, meta);
    const user: AuthUser = { id: userId, email, user_metadata: meta };
    const session: Session = { access_token: userId, refresh_token: uid(), user };
    saveSession(session);
    setCurrentUserId(userId);
    emit("SIGNED_IN", session);
    scheduleSave();
    return { data: { user }, error: null };
  },

  async signInWithPassword(args: {
    email: string;
    password: string;
  }): Promise<{ data: { user: AuthUser | null }; error: { message: string } | null }> {
    const { initDb } = await import("./engine");
    await initDb();
    const email = args.email.trim().toLowerCase();
    const rows = execAll(`SELECT id, email, password_hash FROM auth_users WHERE email = ?`, [
      email,
    ]);
    const row = rows[0];
    if (!row) return { data: { user: null }, error: { message: "Invalid login credentials" } };
    const ok = await verifyPassword(args.password, row.password_hash);
    if (!ok) return { data: { user: null }, error: { message: "Invalid login credentials" } };
    const user: AuthUser = { id: row.id, email: row.email };
    const session: Session = { access_token: row.id, refresh_token: uid(), user };
    saveSession(session);
    setCurrentUserId(row.id);
    emit("SIGNED_IN", session);
    return { data: { user }, error: null };
  },

  async signOut(): Promise<{ error: { message: string } | null }> {
    saveSession(null);
    setCurrentUserId(null);
    emit("SIGNED_OUT", null);
    return { error: null };
  },

  onAuthStateChange(cb: Listener): { data: { subscription: { unsubscribe: () => void } } } {
    listeners.add(cb);
    return {
      data: {
        subscription: {
          unsubscribe: () => listeners.delete(cb),
        },
      },
    };
  },

  // Compat stubs (used by integration-managed attacher / lovable).
  async setSession(
    tokens: any,
  ): Promise<{ data: { session: Session | null }; error: { message: string } | null }> {
    return { data: { session: loadSession() }, error: null };
  },
  async getClaims(
    token: string,
  ): Promise<{ data: { claims: { sub: string } | null }; error: { message: string } | null }> {
    const session = loadSession();
    const sub = session?.user?.id ?? null;
    return {
      data: { claims: sub ? { sub } : null },
      error: sub ? null : { message: "Invalid token" },
    };
  },
};

// Replicates the Postgres handle_new_user trigger + seed_default_units + CoA.
export async function provisionNewUser(
  userId: string,
  email: string,
  meta: Record<string, any>,
): Promise<void> {
  const displayName = meta.display_name || meta.full_name || meta.name || email.split("@")[0];
  const companyName = meta.company_name || `${displayName}'s Company`;

  const companyId = uid();
  execRun(
    `INSERT INTO companies (id, name, legal_name, base_currency, timezone, is_active, created_by) VALUES (?, ?, ?, 'IDR', 'Asia/Jakarta', 1, ?)`,
    [companyId, companyName, companyName, userId],
  );

  const branchId = uid();
  execRun(
    `INSERT INTO branches (id, company_id, code, name, is_active) VALUES (?, ?, 'MAIN', 'Main Branch', 1)`,
    [branchId, companyId],
  );

  const whId = uid();
  execRun(
    `INSERT INTO warehouses (id, company_id, branch_id, code, name, is_default, is_active) VALUES (?, ?, ?, 'MAIN-WH', 'Main Warehouse', 1, 1)`,
    [whId, companyId, branchId],
  );

  execRun(`INSERT INTO user_roles (id, user_id, company_id, role) VALUES (?, ?, ?, 'owner')`, [
    uid(),
    userId,
    companyId,
  ]);
  execRun(`INSERT INTO user_warehouse_access (id, user_id, warehouse_id) VALUES (?, ?, ?)`, [
    uid(),
    userId,
    whId,
  ]);

  execRun(`INSERT INTO profiles (id, display_name, email, active_company_id) VALUES (?, ?, ?, ?)`, [
    userId,
    displayName,
    email,
    companyId,
  ]);

  // seed default units
  for (const [code, name, cat] of [
    ["PCS", "Pieces", "count"],
    ["BOX", "Box", "count"],
    ["KG", "Kilogram", "weight"],
    ["G", "Gram", "weight"],
    ["L", "Liter", "volume"],
    ["M", "Meter", "length"],
  ] as const) {
    execRun(
      `INSERT INTO units (id, company_id, code, name, category, is_active) VALUES (?, ?, ?, ?, ?, 1)`,
      [uid(), companyId, code, name, cat],
    );
  }

  seedDefaultCoa(companyId);
  scheduleSave();
}

// Exposed so the superadmin seed can reuse it.
export function seedDefaultCoa(companyId: string): void {
  const accounts: [string, string, string, string, number][] = [
    ["1000", "Aset", "asset", "debit", 1],
    ["1100", "Kas", "asset", "debit", 0],
    ["1110", "Bank", "asset", "debit", 0],
    ["1200", "Piutang Usaha", "asset", "debit", 0],
    ["1300", "Persediaan", "asset", "debit", 0],
    ["1400", "PPN Masukan", "asset", "debit", 0],
    ["1500", "Aset Tetap", "asset", "debit", 0],
    ["2000", "Kewajiban", "liability", "credit", 1],
    ["2100", "Utang Usaha", "liability", "credit", 0],
    ["2200", "PPN Keluaran", "liability", "credit", 0],
    ["2300", "Utang Pajak", "liability", "credit", 0],
    ["2400", "Utang Gaji", "liability", "credit", 0],
    ["2410", "Utang PPh 21", "liability", "credit", 0],
    ["3000", "Ekuitas", "equity", "credit", 1],
    ["3100", "Modal", "equity", "credit", 0],
    ["3200", "Laba Ditahan", "equity", "credit", 0],
    ["4000", "Pendapatan", "revenue", "credit", 1],
    ["4100", "Penjualan", "revenue", "credit", 0],
    ["4200", "Pendapatan Lain-lain", "revenue", "credit", 0],
    ["5000", "Beban Pokok Penjualan", "expense", "debit", 1],
    ["5100", "HPP", "expense", "debit", 0],
    ["6000", "Beban Operasional", "expense", "debit", 1],
    ["6100", "Beban Gaji", "expense", "debit", 0],
    ["6200", "Beban Sewa", "expense", "debit", 0],
    ["6300", "Beban Utilitas", "expense", "debit", 0],
    ["6900", "Beban Lain-lain", "expense", "debit", 0],
  ];
  for (const [code, name, type, nb, isGroup] of accounts) {
    execRun(
      `INSERT OR IGNORE INTO accounts (id, company_id, code, name, account_type, normal_balance, is_group, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [uid(), companyId, code, name, type, nb, isGroup],
    );
  }
}
