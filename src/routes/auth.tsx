import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

const searchSchema = z.object({
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Masuk — Axon ERP" },
      { name: "description", content: "Masuk atau daftar ke Axon ERP." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If already signed in, redirect straight to app
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: redirect || "/app", replace: true });
    });
  }, [navigate, redirect]);

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + "/app",
            data: {
              display_name: displayName || email.split("@")[0],
              company_name: companyName || undefined,
            },
          },
        });
        if (error) throw error;
        toast.success("Akun berhasil dibuat!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: redirect || "/app", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Autentikasi gagal");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin + "/auth",
      });
      if (result.error) {
        toast.error(result.error.message);
        setLoading(false);
        return;
      }
      if (result.redirected) return;
      // Session set via helper — go to app
      navigate({ to: redirect || "/app", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in gagal");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="inline-block mb-8 font-extrabold tracking-tighter text-xl">
          AXON.
        </Link>
        <div className="border border-border bg-background rounded-xl p-8 shadow-lg">
          <h1 className="text-2xl font-extrabold tracking-tight mb-1">
            {mode === "signin" ? "Masuk ke Axon" : "Buat akun Axon"}
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            {mode === "signin"
              ? "Kelola operasi bisnis Anda dari satu tempat."
              : "Perusahaan default akan dibuat otomatis untuk Anda."}
          </p>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="w-full mb-4 px-4 py-2.5 border border-border rounded font-medium text-sm hover:bg-surface transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Lanjutkan dengan Google
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-background px-2 text-muted-foreground">atau email</span>
            </div>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            {mode === "signup" && (
              <>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nama Anda</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-border rounded bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Budi Santoso"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Nama Perusahaan</label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-border rounded bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="PT Contoh Sejahtera"
                  />
                </div>
              </>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-border rounded bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="anda@perusahaan.com"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full px-3 py-2 border border-border rounded bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Minimal 6 karakter"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded font-bold text-sm hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50"
            >
              {loading ? "Memproses..." : mode === "signin" ? "Masuk" : "Daftar"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            {mode === "signin" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
            <button
              type="button"
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-primary font-medium hover:underline"
            >
              {mode === "signin" ? "Daftar sekarang" : "Masuk"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
