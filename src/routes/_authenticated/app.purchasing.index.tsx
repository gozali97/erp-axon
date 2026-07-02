import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ShoppingCart } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/app/purchasing/")({
  component: PurchaseOrdersPage,
});

const statusColor: Record<string, string> = {
  draft: "text-muted-foreground bg-surface border-border",
  submitted: "text-blue-700 bg-blue-50 border-blue-200",
  approved: "text-indigo-700 bg-indigo-50 border-indigo-200",
  partial: "text-amber-700 bg-amber-50 border-amber-200",
  received: "text-green-700 bg-green-50 border-green-200",
  closed: "text-muted-foreground bg-surface border-border",
  cancelled: "text-red-700 bg-red-50 border-red-200",
};

function PurchaseOrdersPage() {
  const { data: companyId } = useActiveCompany();
  const [open, setOpen] = useState(false);

  const { data: pos, isLoading } = useQuery({
    queryKey: ["purchase-orders", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("id, po_no, order_date, expected_date, status, grand_total, currency, suppliers(name), warehouses(code)")
        .eq("company_id", companyId!)
        .order("order_date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">Dokumen pesanan pembelian dari supplier.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="size-4" /> PO baru</Button>
          </DialogTrigger>
          <CreatePODialog companyId={companyId} onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr className="text-left">
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">No. PO</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Tanggal</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Supplier</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Gudang</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Memuat…</td></tr>}
            {!isLoading && (pos?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <ShoppingCart className="mx-auto size-8 text-muted-foreground mb-3" />
                  <div className="font-medium mb-1">Belum ada PO</div>
                  <Button onClick={() => setOpen(true)} size="sm" className="mt-2 gap-2"><Plus className="size-4" /> Buat PO pertama</Button>
                </td>
              </tr>
            )}
            {pos?.map((po) => (
              <tr key={po.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link to="/app/purchasing/orders/$poId" params={{ poId: po.id }} className="text-primary hover:underline font-medium">
                    {po.po_no}
                  </Link>
                </td>
                <td className="px-4 py-3 text-xs">{po.order_date}</td>
                <td className="px-4 py-3">{(po.suppliers as { name: string } | null)?.name}</td>
                <td className="px-4 py-3 font-mono text-xs">{(po.warehouses as { code: string } | null)?.code}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border ${statusColor[po.status] || ""}`}>{po.status}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {Number(po.grand_total).toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                  <span className="text-[10px] text-muted-foreground ml-1">{po.currency}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type PoLine = { product_id: string; description: string; quantity: string; unit_price: string; tax_pct: string };

function CreatePODialog({ companyId, onDone }: { companyId: string | null | undefined; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [supplierId, setSupplierId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<PoLine[]>([
    { product_id: "", description: "", quantity: "1", unit_price: "0", tax_pct: "11" },
  ]);

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers-select", companyId],
    enabled: !!companyId,
    queryFn: async () => (await supabase.from("suppliers").select("id, code, name").eq("company_id", companyId!).eq("is_active", true).order("name")).data ?? [],
  });
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses-select-po", companyId],
    enabled: !!companyId,
    queryFn: async () => (await supabase.from("warehouses").select("id, code, name").eq("company_id", companyId!).eq("is_active", true).order("name")).data ?? [],
  });
  const { data: products } = useQuery({
    queryKey: ["products-select-po", companyId],
    enabled: !!companyId,
    queryFn: async () => (await supabase.from("products").select("id, sku, name, purchase_price").eq("company_id", companyId!).eq("is_active", true).neq("product_type", "service").order("name").limit(500)).data ?? [],
  });

  const totals = lines.reduce(
    (acc, l) => {
      const q = Number(l.quantity) || 0;
      const p = Number(l.unit_price) || 0;
      const t = Number(l.tax_pct) || 0;
      const sub = q * p;
      const tax = (sub * t) / 100;
      acc.sub += sub; acc.tax += tax;
      return acc;
    }, { sub: 0, tax: 0 }
  );

  const create = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No active company");
      if (!supplierId || !warehouseId) throw new Error("Supplier dan gudang wajib diisi");
      const clean = lines.filter((l) => l.product_id && Number(l.quantity) > 0);
      if (clean.length === 0) throw new Error("Minimal satu baris produk");
      const { data, error } = await supabase.rpc("create_purchase_order", {
        _company_id: companyId,
        _supplier_id: supplierId,
        _warehouse_id: warehouseId,
        _order_date: orderDate,
        _expected_date: expectedDate || (null as unknown as string),
        _notes: notes || (null as unknown as string),
        _lines: clean.map((l) => ({
          product_id: l.product_id,
          description: l.description || null,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
          discount_pct: 0,
          tax_pct: Number(l.tax_pct) || 0,
        })),
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("PO berhasil dibuat");
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal membuat PO"),
  });

  return (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Purchase Order baru</DialogTitle></DialogHeader>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="col-span-2">
          <Label>Supplier *</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger><SelectValue placeholder="Pilih supplier" /></SelectTrigger>
            <SelectContent>
              {suppliers?.map((s) => <SelectItem key={s.id} value={s.id}>{s.code} — {s.name}</SelectItem>)}
              {(suppliers?.length ?? 0) === 0 && <div className="px-2 py-4 text-xs text-muted-foreground">Belum ada supplier. Tambah di tab Suppliers.</div>}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Gudang tujuan *</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger><SelectValue placeholder="Pilih gudang" /></SelectTrigger>
            <SelectContent>
              {warehouses?.map((w) => <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label>Tanggal PO</Label><Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} /></div>
        <div><Label>Tgl. diharapkan</Label><Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} /></div>
      </div>

      <div className="border border-border rounded overflow-hidden mb-3">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border text-left">
            <tr>
              <th className="px-2 py-2 font-mono text-[10px] uppercase text-muted-foreground">Produk</th>
              <th className="px-2 py-2 font-mono text-[10px] uppercase text-muted-foreground w-24 text-right">Qty</th>
              <th className="px-2 py-2 font-mono text-[10px] uppercase text-muted-foreground w-32 text-right">Harga</th>
              <th className="px-2 py-2 font-mono text-[10px] uppercase text-muted-foreground w-20 text-right">PPN %</th>
              <th className="px-2 py-2 font-mono text-[10px] uppercase text-muted-foreground w-32 text-right">Subtotal</th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const sub = (Number(l.quantity) || 0) * (Number(l.unit_price) || 0);
              return (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="p-1">
                    <Select value={l.product_id} onValueChange={(v) => {
                      const p = products?.find((x) => x.id === v);
                      const next = [...lines];
                      next[i] = { ...next[i], product_id: v, unit_price: next[i].unit_price === "0" ? String(p?.purchase_price ?? 0) : next[i].unit_price };
                      setLines(next);
                    }}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                      <SelectContent>
                        {products?.map((p) => <SelectItem key={p.id} value={p.id}>{p.sku} — {p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="p-1"><Input className="h-8 text-right font-mono" type="number" step="0.0001" value={l.quantity} onChange={(e) => { const n = [...lines]; n[i].quantity = e.target.value; setLines(n); }} /></td>
                  <td className="p-1"><Input className="h-8 text-right font-mono" type="number" step="0.01" value={l.unit_price} onChange={(e) => { const n = [...lines]; n[i].unit_price = e.target.value; setLines(n); }} /></td>
                  <td className="p-1"><Input className="h-8 text-right font-mono" type="number" step="0.01" value={l.tax_pct} onChange={(e) => { const n = [...lines]; n[i].tax_pct = e.target.value; setLines(n); }} /></td>
                  <td className="p-2 text-right font-mono tabular-nums text-xs">{sub.toLocaleString("id-ID", { maximumFractionDigits: 2 })}</td>
                  <td className="p-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLines(lines.filter((_, x) => x !== i))} disabled={lines.length === 1}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between mb-3">
        <Button variant="outline" size="sm" onClick={() => setLines([...lines, { product_id: "", description: "", quantity: "1", unit_price: "0", tax_pct: "11" }])}>
          + Baris
        </Button>
        <div className="text-xs font-mono space-y-1 text-right">
          <div>Subtotal: <span className="tabular-nums font-medium">{totals.sub.toLocaleString("id-ID", { maximumFractionDigits: 2 })}</span></div>
          <div>Pajak: <span className="tabular-nums font-medium">{totals.tax.toLocaleString("id-ID", { maximumFractionDigits: 2 })}</span></div>
          <div className="text-base font-bold">Total: <span className="tabular-nums">{(totals.sub + totals.tax).toLocaleString("id-ID", { maximumFractionDigits: 2 })}</span></div>
        </div>
      </div>

      <div>
        <Label>Catatan</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Batal</Button>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? "Menyimpan…" : "Buat PO"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
