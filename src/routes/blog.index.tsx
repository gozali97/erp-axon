import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "Blog — Axon ERP" },
      { name: "description", content: "Insights, product updates, dan panduan tentang ERP untuk mid-market." },
      { property: "og:title", content: "Blog — Axon ERP" },
      { property: "og:description", content: "Insights, product updates, dan panduan tentang ERP." },
    ],
  }),
  component: BlogList,
});

type Post = { id: string; slug: string; title: string; excerpt: string | null; cover_url: string | null; published_at: string | null };

function BlogList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase
      .from("cms_posts")
      .select("id, slug, title, excerpt, cover_url, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .then(({ data }) => {
        setPosts((data ?? []) as Post[]);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-extrabold tracking-tighter text-lg">AXON.</Link>
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Kembali</Link>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-6 py-16">
        <div className="mb-12">
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-3 font-bold">Journal</div>
          <h1 className="text-5xl font-extrabold tracking-tight">Blog Axon</h1>
        </div>
        {loading ? (
          <div className="text-muted-foreground">Memuat…</div>
        ) : posts.length === 0 ? (
          <div className="text-muted-foreground border border-dashed border-border rounded-lg p-12 text-center">
            Belum ada tulisan yang dipublikasikan.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-8">
            {posts.map((p) => (
              <Link
                key={p.id}
                to="/blog/$slug"
                params={{ slug: p.slug }}
                className="group border border-border rounded-lg overflow-hidden hover:shadow-lg transition-shadow bg-card"
              >
                {p.cover_url && (
                  <img src={p.cover_url} alt={p.title} className="w-full aspect-video object-cover" />
                )}
                <div className="p-5">
                  <div className="font-mono text-[10px] uppercase text-muted-foreground mb-2">
                    {p.published_at ? new Date(p.published_at).toLocaleDateString() : ""}
                  </div>
                  <h2 className="text-xl font-bold group-hover:text-primary transition-colors">{p.title}</h2>
                  {p.excerpt && <p className="text-sm text-muted-foreground mt-2 line-clamp-3">{p.excerpt}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
