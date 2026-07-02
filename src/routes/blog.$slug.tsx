import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/blog/$slug")({
  component: BlogPost,
});

type Post = { id: string; slug: string; title: string; excerpt: string | null; body: string | null; cover_url: string | null; published_at: string | null };

function BlogPost() {
  const { slug } = Route.useParams();
  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("cms_posts")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .maybeSingle()
      .then(({ data }) => {
        setPost(data as Post | null);
        setLoading(false);
      });
  }, [slug]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b border-border">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-extrabold tracking-tighter text-lg">AXON.</Link>
          <Link to="/blog" className="text-sm text-muted-foreground hover:text-foreground">← Semua post</Link>
        </div>
      </nav>
      <main className="max-w-3xl mx-auto px-6 py-16">
        {loading ? (
          <div className="text-muted-foreground">Memuat…</div>
        ) : !post ? (
          <div className="text-muted-foreground">Post tidak ditemukan.</div>
        ) : (
          <article>
            <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-3 font-bold">
              {post.published_at ? new Date(post.published_at).toLocaleDateString() : ""}
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight leading-[1.05] mb-6">{post.title}</h1>
            {post.excerpt && <p className="text-xl text-muted-foreground mb-8">{post.excerpt}</p>}
            {post.cover_url && (
              <img src={post.cover_url} alt={post.title} className="w-full rounded-lg mb-10" />
            )}
            {post.body && (
              <div className="prose prose-neutral max-w-none whitespace-pre-wrap leading-relaxed">
                {post.body}
              </div>
            )}
          </article>
        )}
      </main>
    </div>
  );
}
