// SQLite local-auth compat: server-side auth gate is a no-op because auth
// state lives in the browser (localStorage + sql.js). Kept as a passthrough
// for any server function that previously chained `requireSupabaseAuth`.
import { createMiddleware } from "@tanstack/react-start";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(async ({ next }) =>
  next({ context: { userId: null as string | null } }),
);
