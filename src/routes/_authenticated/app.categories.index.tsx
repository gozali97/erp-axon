import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Boxes } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/categories/")({
  component: CategoriesPage,
});

type Category = { id: string; code: string; name: string; parent_id: string | null; description: string | null; is_active: boolean };

function CategoriesPage() {
  const { data: companyId } = useActiveCompany();
  const [open, setOpen] = useState(false);

  const { data: categories, isLoading } = useQuery({
    queryKey: ["categories", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, code, name, parent_id, description, is_active")
        .eq("company_id", companyId!)
        .order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  // Build tree
  const roots = (categories ?? []).filter((c) => !c.parent_id);
  const childrenOf = (id: string) => (categories ?? []).filter((c) => c.parent_id === id);

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-2 font-bold">
            Master Data / Categories
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Categories</h1>
          <p className="text-muted-foreground mt-1 text-sm">Kategori produk hierarkis (parent → child).</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="size-4" /> Kategori baru</Button>
          </DialogTrigger>
          <CreateCategoryDialog companyId={companyId} categories={categories ?? []} onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="border border-border rounded-lg bg-background">
        {isLoading && <div className="p-8 text-center text-sm text-muted-foreground">Memuat…</div>}
        {!isLoading && roots.length === 0 && (
          <div className="p-16 text-center">
            <Boxes className="mx-auto size-8 text-muted-foreground mb-3" />
            <div className="font-medium mb-1">Belum ada kategori</div>
            <div className="text-xs text-muted-foreground mb-4">Kelompokkan produk agar lebih mudah dicari.</div>
            <Button onClick={() => setOpen(true)} size="sm" className="gap-2"><Plus className="size-4" /> Tambah kategori</Button>
          </div>
        )}
        <div className="divide-y divide-border">
          {roots.map((c) => (
            <CategoryRow key={c.id} category={c} depth={0} childrenOf={childrenOf} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CategoryRow({ category, depth, childrenOf }: { category: Category; depth: number; childrenOf: (id: string) => Category[] }) {
  const children = childrenOf(category.id);
  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3" style={{ paddingLeft: 16 + depth * 20 }}>
        <span className="font-mono text-[10px] uppercase text-muted-foreground w-16">{category.code}</span>
        <span className="font-medium flex-1">{category.name}</span>
        {!category.is_active && <span className="text-[10px] font-mono uppercase text-muted-foreground">inactive</span>}
      </div>
      {children.map((child) => (
        <CategoryRow key={child.id} category={child} depth={depth + 1} childrenOf={childrenOf} />
      ))}
    </>
  );
}

function CreateCategoryDialog({ companyId, categories, onDone }: { companyId: string | null | undefined; categories: Category[]; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ code: "", name: "", description: "", parent_id: "" });

  const create = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No active company");
      if (!form.code.trim() || !form.name.trim()) throw new Error("Kode dan nama wajib diisi");
      const { error } = await supabase.from("categories").insert({
        company_id: companyId,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        parent_id: form.parent_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kategori dibuat");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories-select"] });
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal membuat kategori"),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Kategori baru</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div>
          <Label htmlFor="code">Kode *</Label>
          <Input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="ELEC" />
        </div>
        <div>
          <Label htmlFor="name">Nama *</Label>
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Electronics" />
        </div>
        <div>
          <Label>Parent (opsional)</Label>
          <Select value={form.parent_id || undefined} onValueChange={(v) => setForm({ ...form, parent_id: v })}>
            <SelectTrigger><SelectValue placeholder="Root category" /></SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="desc">Deskripsi</Label>
          <Textarea id="desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Batal</Button>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? "Menyimpan…" : "Simpan"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
