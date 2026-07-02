import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Factory, Trash2, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/manufacturing/bom")({
  component: BomPage,
});

function BomPage() {
  const { data: companyId } = useActiveCompany();
  const qc = useQueryClient();
  const [openBom, setOpenBom] = useState(false);
  const [openComp, setOpenComp] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const { data: boms } = useQuery({
    queryKey: ["boms", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bills_of_materials")
        .select("*, products(sku, name)")
        .eq("company_id", companyId!)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: components } = useQuery({
    queryKey: ["bom-components", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bom_components")
        .select("*, products(sku, name)")
        .eq("bom_id", selected!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const delComp = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bom_components").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bom-components"] }); toast.success("Komponen dihapus"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">Bills of Materials</h2>
          <Dialog open={openBom} onOpenChange={setOpenBom}>
            <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="size-4" /> Baru</Button></DialogTrigger>
            <BomDialog companyId={companyId} onDone={() => setOpenBom(false)} />
          </Dialog>
        </div>
        <div className="border border-border rounded-lg bg-background divide-y divide-border">
          {(boms?.length ?? 0) === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Factory className="mx-auto size-8 mb-2" />Belum ada BOM
            </div>
          )}
          {boms?.map((b: any) => (
            <button key={b.id} onClick={() => setSelected(b.id)} className={`w-full text-left p-3 hover:bg-surface/50 flex items-center justify-between ${selected === b.id ? "bg-surface" : ""}`}>
              <div>
                <div className="font-mono text-xs">{b.code} <span className="text-muted-foreground">• {b.version}</span></div>
                <div className="text-sm font-medium">{b.products?.name}</div>
                <div className="text-[10px] font-mono uppercase text-muted-foreground">Output: {Number(b.output_quantity)} • {b.is_active ? "Aktif" : "Nonaktif"}</div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2">
        {!selected && <div className="border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">Pilih BOM untuk melihat komponen</div>}
        {selected && (() => {
          const bom = boms?.find((b: any) => b.id === selected);
          if (!bom) return null;
          return (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-mono text-xs text-muted-foreground">{bom.code} • {bom.version}</div>
                  <h3 className="text-lg font-bold">{bom.products?.name}</h3>
                  <div className="text-xs text-muted-foreground">Output {Number(bom.output_quantity)} unit per resep</div>
                </div>
                <Dialog open={openComp} onOpenChange={setOpenComp}>
                  <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="size-4" /> Komponen</Button></DialogTrigger>
                  <ComponentDialog companyId={companyId} bomId={selected} onDone={() => setOpenComp(false)} />
                </Dialog>
              </div>

              <div className="border border-border rounded-lg overflow-hidden bg-background">
                <table className="w-full text-sm">
                  <thead className="bg-surface border-b border-border">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">SKU</th>
                      <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Komponen</th>
                      <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Qty</th>
                      <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Waste %</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(components?.length ?? 0) === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Belum ada komponen</td></tr>}
                    {components?.map((c: any) => (
                      <tr key={c.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-mono text-xs">{c.products?.sku}</td>
                        <td className="px-3 py-2">{c.products?.name}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{Number(c.quantity)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{Number(c.waste_pct)}%</td>
                        <td className="px-3 py-2 text-right">
                          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => delComp.mutate(c.id)}><Trash2 className="size-3.5" /></Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function BomDialog({ companyId, onDone }: { companyId?: string | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ product_id: "", code: "", version: "v1", output_quantity: 1, notes: "" });

  const { data: products } = useQuery({
    queryKey: ["products-lite", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id,sku,name").eq("company_id", companyId!).eq("is_active", true).order("name").limit(500);
      return data ?? [];
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      const { error } = await supabase.from("bills_of_materials").insert({
        company_id: companyId,
        product_id: form.product_id,
        code: form.code,
        version: form.version,
        output_quantity: form.output_quantity,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["boms"] }); toast.success("BOM dibuat"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>BOM baru</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Produk (barang jadi)</Label>
          <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
            <option value="">— pilih —</option>
            {products?.map((p: any) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Kode BOM</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="BOM-001" /></div>
          <div><Label>Versi</Label><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} /></div>
        </div>
        <div><Label>Output qty per resep</Label><Input type="number" step="0.0001" value={form.output_quantity} onChange={(e) => setForm({ ...form, output_quantity: Number(e.target.value) })} /></div>
        <div><Label>Catatan</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.product_id || !form.code}>Simpan</Button></DialogFooter>
    </DialogContent>
  );
}

function ComponentDialog({ companyId, bomId, onDone }: { companyId?: string | null; bomId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ component_product_id: "", quantity: 1, waste_pct: 0 });

  const { data: products } = useQuery({
    queryKey: ["products-lite", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("products").select("id,sku,name").eq("company_id", companyId!).eq("is_active", true).order("name").limit(500);
      return data ?? [];
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      const { error } = await supabase.from("bom_components").insert({
        company_id: companyId,
        bom_id: bomId,
        component_product_id: form.component_product_id,
        quantity: form.quantity,
        waste_pct: form.waste_pct,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["bom-components", bomId] }); toast.success("Komponen ditambahkan"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Tambah komponen</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Komponen</Label>
          <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" value={form.component_product_id} onChange={(e) => setForm({ ...form, component_product_id: e.target.value })}>
            <option value="">— pilih —</option>
            {products?.map((p: any) => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Qty per resep</Label><Input type="number" step="0.0001" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} /></div>
          <div><Label>Waste %</Label><Input type="number" step="0.01" value={form.waste_pct} onChange={(e) => setForm({ ...form, waste_pct: Number(e.target.value) })} /></div>
        </div>
      </div>
      <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.component_product_id}>Simpan</Button></DialogFooter>
    </DialogContent>
  );
}
