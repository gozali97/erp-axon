// Local stub for the Lovable OAuth integration.
// Google OAuth is no longer wired to Supabase; the local SQLite auth flow handles
// sign-in via email/password. This stub keeps the import in auth.tsx working.
export const lovable = {
  auth: {
    signInWithOAuth: async (_provider: string, _opts?: { redirect_uri?: string }) => {
      return {
        redirected: false,
        error: new Error(
          "OAuth sign-in tidak tersedia di mode lokal SQLite. Gunakan email/password.",
        ),
      };
    },
  },
};
