import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Sliders } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/app/inventory/movements")({
  component: MovementsPage,
});

type MovementKind = "in" | "out" | "transfer" | "adjustment";

function MovementsPage() {
  const { data: companyId } = useActiveCompany();
  const [open, setOpen] = useState(false);

  const { data: movements, isLoading } = useQuery({
    queryKey: ["stock-movements", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, movement_no, movement_date, movement_type, source, quantity, unit_cost, total_cost, notes, warehouse_id, counterparty_warehouse_id, products(sku, name, units(code)), warehouses!stock_movements_warehouse_id_fkey(code)")
        .eq("company_id", companyId!)
        .order("movement_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">
          Jurnal pergerakan stok (immutable). Semua penambahan/pengurangan/transfer dicatat di sini.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="size-4" /> Pergerakan baru</Button>
          </DialogTrigger>
          <NewMovementDialog companyId={companyId} onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr className="text-left">
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">No.</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Tanggal</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Jenis</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Produk</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Gudang</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Qty</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Unit Cost</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Memuat…</td></tr>}
            {!isLoading && (movements?.length ?? 0) === 0 && (
              <tr><td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">Belum ada pergerakan.</td></tr>
            )}
            {movements?.map((m) => {
              const p = m.products as { sku: string; name: string; units: { code: string } | null } | null;
              const w = m.warehouses as { code: string } | null;
              const inbound = m.movement_type === "in" || m.movement_type === "transfer_in";
              const badge = (() => {
                switch (m.movement_type) {
                  case "in": return { label: "IN", cls: "text-green-700 bg-green-50 border-green-200", Icon: ArrowDownToLine };
                  case "out": return { label: "OUT", cls: "text-red-700 bg-red-50 border-red-200", Icon: ArrowUpFromLine };
                  case "transfer_in": return { label: "TRF IN", cls: "text-blue-700 bg-blue-50 border-blue-200", Icon: ArrowLeftRight };
                  case "transfer_out": return { label: "TRF OUT", cls: "text-blue-700 bg-blue-50 border-blue-200", Icon: ArrowLeftRight };
                  case "adjustment": return { label: "ADJ", cls: "text-amber-700 bg-amber-50 border-amber-200", Icon: Sliders };
                  case "opname": return { label: "OPNAME", cls: "text-purple-700 bg-purple-50 border-purple-200", Icon: Sliders };
                }
              })()!;
              return (
                <tr key={m.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                  <td className="px-4 py-3 font-mono text-xs">{m.movement_no}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(m.movement_date).toLocaleString("id-ID", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 border ${badge.cls}`}>
                      <badge.Icon className="size-3" /> {badge.label}
                    </span>
                    <span className="ml-2 text-[10px] font-mono uppercase text-muted-foreground">{m.source}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p?.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{p?.sku}</div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{w?.code}</td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums font-medium ${inbound ? "text-green-700" : "text-red-700"}`}>
                    {inbound ? "+" : "−"}{Number(m.quantity).toLocaleString("id-ID", { maximumFractionDigits: 4 })}
                    <span className="text-[10px] text-muted-foreground ml-1">{p?.units?.code}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                    {Number(m.unit_cost).toLocaleString("id-ID", { minimumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {Number(m.total_cost).toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewMovementDialog({ companyId, onDone }: { companyId: string | null | undefined; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<MovementKind>("in");
  const [form, setForm] = useState({
    product_id: "",
    warehouse_id: "",
    to_warehouse_id: "",
    quantity: "",
    unit_cost: "",
    notes: "",
  });

  const { data: products } = useQuery({
    queryKey: ["products-select", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("products").select("id, sku, name, purchase_price, product_type")
        .eq("company_id", companyId!).eq("is_active", true)
        .neq("product_type", "service")
        .order("name").limit(500);
      return data ?? [];
    },
  });

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses-select", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("warehouses").select("id, code, name")
        .eq("company_id", companyId!).eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No active company");
      const qty = Number(form.quantity);
      if (!form.product_id || !form.warehouse_id || !qty) {
        throw new Error("Produk, gudang, dan qty wajib diisi");
      }
      const unitCost = Number(form.unit_cost) || 0;
      if (kind === "in") {
        const { error } = await supabase.rpc("post_stock_movement", {
          _company_id: companyId,
          _warehouse_id: form.warehouse_id,
          _product_id: form.product_id,
          _movement_type: "in",
          _source: "purchase",
          _quantity: qty,
          _unit_cost: unitCost,
          _notes: form.notes || undefined,
        });
        if (error) throw error;
      } else if (kind === "out") {
        const { error } = await supabase.rpc("post_stock_movement", {
          _company_id: companyId,
          _warehouse_id: form.warehouse_id,
          _product_id: form.product_id,
          _movement_type: "out",
          _source: "sale",
          _quantity: qty,
          _unit_cost: unitCost,
          _notes: form.notes || undefined,
        });
        if (error) throw error;
      } else if (kind === "transfer") {
        if (!form.to_warehouse_id) throw new Error("Gudang tujuan wajib diisi");
        const { error } = await supabase.rpc("post_stock_transfer", {
          _company_id: companyId,
          _product_id: form.product_id,
          _from_warehouse: form.warehouse_id,
          _to_warehouse: form.to_warehouse_id,
          _quantity: qty,
          _unit_cost: unitCost,
          _notes: form.notes || undefined,
        });
        if (error) throw error;
      } else if (kind === "adjustment") {
        const { error } = await supabase.rpc("post_stock_adjustment", {
          _company_id: companyId,
          _warehouse_id: form.warehouse_id,
          _product_id: form.product_id,
          _delta: qty, // caller enters signed number
          _unit_cost: unitCost,
          _notes: form.notes || undefined,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Pergerakan stok berhasil dicatat");
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
      onDone();
      setForm({ product_id: "", warehouse_id: "", to_warehouse_id: "", quantity: "", unit_cost: "", notes: "" });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal mencatat pergerakan"),
  });

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>Pergerakan stok baru</DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-4 gap-2 mb-2">
        {(["in", "out", "transfer", "adjustment"] as MovementKind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`px-3 py-2 text-xs font-mono uppercase border transition-colors ${
              kind === k ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-surface"
            }`}
          >
            {k === "in" ? "Masuk" : k === "out" ? "Keluar" : k === "transfer" ? "Transfer" : "Adjust"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <Label>Produk *</Label>
          <Select value={form.product_id} onValueChange={(v) => {
            const p = products?.find((x) => x.id === v);
            setForm({ ...form, product_id: v, unit_cost: form.unit_cost || String(p?.purchase_price ?? "") });
          }}>
            <SelectTrigger><SelectValue placeholder="Pilih produk" /></SelectTrigger>
            <SelectContent>
              {products?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>{kind === "transfer" ? "Gudang asal *" : "Gudang *"}</Label>
          <Select value={form.warehouse_id} onValueChange={(v) => setForm({ ...form, warehouse_id: v })}>
            <SelectTrigger><SelectValue placeholder="Pilih gudang" /></SelectTrigger>
            <SelectContent>
              {warehouses?.map((w) => (
                <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {kind === "transfer" && (
          <div>
            <Label>Gudang tujuan *</Label>
            <Select value={form.to_warehouse_id} onValueChange={(v) => setForm({ ...form, to_warehouse_id: v })}>
              <SelectTrigger><SelectValue placeholder="Pilih gudang" /></SelectTrigger>
              <SelectContent>
                {warehouses?.filter((w) => w.id !== form.warehouse_id).map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <Label>Qty {kind === "adjustment" ? "(bertanda, contoh -3)" : "*"}</Label>
          <Input
            type="number" step="0.0001"
            value={form.quantity}
            onChange={(e) => setForm({ ...form, quantity: e.target.value })}
            placeholder={kind === "adjustment" ? "±0.0000" : "0.0000"}
          />
        </div>

        <div>
          <Label>Unit cost</Label>
          <Input
            type="number" step="0.01" min="0"
            value={form.unit_cost}
            onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
            placeholder="0.00"
          />
        </div>

        <div className="col-span-2">
          <Label>Catatan</Label>
          <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Batal</Button>
        <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
          {submit.isPending ? "Memproses…" : "Catat pergerakan"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
