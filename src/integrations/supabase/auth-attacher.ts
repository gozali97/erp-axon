// SQLite local-auth compat: no remote bearer token is needed because the DB
// lives in the browser. This middleware is a no-op pass-through so serverFn
// RPCs still work without attaching Supabase credentials.
import { createMiddleware } from "@tanstack/react-start";

export const attachSupabaseAuth = createMiddleware({ type: "function" }).client(async ({ next }) =>
  next({ headers: {} }),
);
