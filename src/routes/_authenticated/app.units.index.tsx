import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Ruler } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/units/")({
  component: UnitsPage,
});

const CATEGORIES = ["count", "weight", "volume", "length", "area", "time", "other"] as const;
type UnitCategory = typeof CATEGORIES[number];

function UnitsPage() {
  const { data: companyId } = useActiveCompany();
  const [open, setOpen] = useState(false);

  const { data: units, isLoading } = useQuery({
    queryKey: ["units", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("units")
        .select("id, code, name, category, is_active")
        .eq("company_id", companyId!)
        .order("category")
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const grouped = (units ?? []).reduce<Record<string, typeof units>>((acc, u) => {
    (acc[u.category] ||= [] as never).push(u);
    return acc;
  }, {});

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-2 font-bold">
            Master Data / Units
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Units of Measure</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Satuan yang digunakan produk. 6 satuan default disediakan otomatis.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="size-4" /> Satuan baru</Button>
          </DialogTrigger>
          <CreateUnitDialog companyId={companyId} onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      {isLoading && <div className="p-8 text-center text-sm text-muted-foreground">Memuat…</div>}

      {!isLoading && Object.keys(grouped).length === 0 && (
        <div className="border border-border rounded-lg bg-background p-16 text-center">
          <Ruler className="mx-auto size-8 text-muted-foreground mb-3" />
          <div className="font-medium mb-1">Belum ada satuan</div>
          <Button onClick={() => setOpen(true)} size="sm" className="gap-2 mt-3"><Plus className="size-4" /> Tambah satuan</Button>
        </div>
      )}

      <div className="grid gap-6">
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat}>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
              [{cat}]
            </div>
            <div className="border border-border rounded-lg bg-background divide-y divide-border">
              {(list ?? []).map((u) => (
                <div key={u.id} className="flex items-center gap-4 px-4 py-3">
                  <span className="font-mono text-sm font-bold w-20">{u.code}</span>
                  <span className="flex-1">{u.name}</span>
                  {!u.is_active && <span className="text-[10px] font-mono uppercase text-muted-foreground">inactive</span>}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CreateUnitDialog({ companyId, onDone }: { companyId: string | null | undefined; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<{ code: string; name: string; category: UnitCategory }>({
    code: "", name: "", category: "count",
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No active company");
      if (!form.code.trim() || !form.name.trim()) throw new Error("Kode dan nama wajib diisi");
      const { error } = await supabase.from("units").insert({
        company_id: companyId,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        category: form.category,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Satuan dibuat");
      queryClient.invalidateQueries({ queryKey: ["units"] });
      queryClient.invalidateQueries({ queryKey: ["units-select"] });
      onDone();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Gagal membuat satuan"),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Satuan baru</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div>
          <Label htmlFor="code">Kode *</Label>
          <Input id="code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="TON" />
        </div>
        <div>
          <Label htmlFor="name">Nama *</Label>
          <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Metric ton" />
        </div>
        <div>
          <Label>Kategori</Label>
          <Select value={form.category} onValueChange={(v: UnitCategory) => setForm({ ...form, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
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
