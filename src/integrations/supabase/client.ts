// SQLite-backed compatibility client.
//
// Exposes the same surface the rest of the app expects from `@supabase/supabase-js`:
//   - supabase.from(table)  -> Supabase-like query builder (backed by sql.js)
//   - supabase.rpc(name, p) -> reimplemented Postgres RPCs
//   - supabase.auth.*       -> local email/password auth (WebCrypto PBKDF2)
//
// Data is persisted to IndexedDB (see src/lib/db/engine.ts) so it survives reloads.
// This is intentionally client-side only; migrate the data layer to a server later
// by swapping the implementation behind this same interface.
import { QueryBuilder } from "@/lib/db/query-builder";
import { rpc } from "@/lib/db/rpc";
import { auth } from "@/lib/db/auth";

export const supabase = {
  from<T = any>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>(table);
  },
  rpc(
    name: string,
    params?: Record<string, any>,
  ): Promise<{ data: any; error: { message: string } | null }> {
    return rpc(name, params);
  },
  auth,
};

export type Database = unknown;
