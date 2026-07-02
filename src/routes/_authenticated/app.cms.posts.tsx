import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/cms/posts")({
  component: PostsList,
});

type Post = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  body: string | null;
  cover_url: string | null;
  status: "draft" | "published";
  published_at: string | null;
  updated_at: string;
};

const empty: Partial<Post> = { slug: "", title: "", excerpt: "", body: "", cover_url: "", status: "draft" };

function PostsList() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Partial<Post>>(empty);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from("cms_posts")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    else setPosts(data as Post[]);
    setLoading(false);
  };
  useEffect(() => {
    load();
  }, []);

  const openNew = () => {
    setForm(empty);
    setOpen(true);
  };
  const openEdit = (p: Post) => {
    setForm(p);
    setOpen(true);
  };

  const save = async () => {
    if (!form.title || !form.slug) {
      toast.error("Judul dan slug wajib");
      return;
    }
    setSaving(true);
    const payload = {
      slug: form.slug,
      title: form.title,
      excerpt: form.excerpt ?? null,
      body: form.body ?? null,
      cover_url: form.cover_url ?? null,
      status: form.status ?? "draft",
      published_at:
        form.status === "published" ? form.published_at ?? new Date().toISOString() : null,
    };
    const { error } = form.id
      ? await supabase.from("cms_posts").update(payload).eq("id", form.id)
      : await supabase.from("cms_posts").insert(payload);
    if (error) toast.error(error.message);
    else {
      toast.success("Tersimpan");
      setOpen(false);
      load();
    }
    setSaving(false);
  };

  const remove = async (id: string) => {
    if (!confirm("Hapus post ini?")) return;
    const { error } = await supabase.from("cms_posts").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Terhapus");
      load();
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-muted-foreground">{posts.length} post</div>
        <Button onClick={openNew}>Post baru</Button>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-sm">Memuat…</div>
      ) : posts.length === 0 ? (
        <div className="text-muted-foreground text-sm border border-dashed border-border rounded-lg p-8 text-center">
          Belum ada post. Klik "Post baru".
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-hidden bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2">Judul</th>
                <th className="text-left px-4 py-2">Slug</th>
                <th className="text-left px-4 py-2">Status</th>
                <th className="text-left px-4 py-2">Diperbarui</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {posts.map((p) => (
                <tr key={p.id} className="border-t border-border">
                  <td className="px-4 py-2 font-medium">{p.title}</td>
                  <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{p.slug}</td>
                  <td className="px-4 py-2">
                    <Badge variant={p.status === "published" ? "default" : "secondary"}>{p.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {new Date(p.updated_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit post" : "Post baru"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Judul</Label>
              <Input
                value={form.title ?? ""}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Slug</Label>
                <Input
                  value={form.slug ?? ""}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="cara-menggunakan-axon"
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={form.status ?? "draft"}
                  onValueChange={(v) => setForm({ ...form, status: v as "draft" | "published" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Cover URL</Label>
              <Input
                value={form.cover_url ?? ""}
                onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
                placeholder="https://…/cover.jpg"
              />
            </div>
            <div>
              <Label>Ringkasan</Label>
              <Textarea
                rows={2}
                value={form.excerpt ?? ""}
                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
              />
            </div>
            <div>
              <Label>Isi (Markdown/Text)</Label>
              <Textarea
                rows={10}
                value={form.body ?? ""}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
