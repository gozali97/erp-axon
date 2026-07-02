import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, PackageCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/purchasing/orders/$poId")({
  component: POPage,
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

function POPage() {
  const { poId } = Route.useParams();
  const { data: companyId } = useActiveCompany();
  const [receiveOpen, setReceiveOpen] = useState(false);

  const { data: po } = useQuery({
    queryKey: ["po", poId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(*), warehouses(code, name)")
        .eq("id", poId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: lines } = useQuery({
    queryKey: ["po-lines", poId],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_order_lines")
        .select("*, products(sku, name, units(code))")
        .eq("purchase_order_id", poId).order("line_no");
      return data ?? [];
    },
  });

  const { data: receipts } = useQuery({
    queryKey: ["po-receipts", poId],
    queryFn: async () => {
      const { data } = await supabase
        .from("goods_receipts")
        .select("id, gr_no, receipt_date, supplier_ref, notes, goods_receipt_lines(quantity, products(sku, name))")
        .eq("purchase_order_id", poId).order("receipt_date", { ascending: false });
      return data ?? [];
    },
  });

  const outstanding = useMemo(() => (lines ?? []).some((l) => Number(l.quantity_received) < Number(l.quantity)), [lines]);

  if (!po) return <div className="p-8 text-muted-foreground">Memuat…</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link to="/app/purchasing" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="size-3.5" /> Kembali
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="font-mono text-xs text-muted-foreground mb-1">{po.po_no}</div>
          <h2 className="text-2xl font-extrabold tracking-tight">
            {(po.suppliers as { name: string } | null)?.name}
          </h2>
          <div className="text-sm text-muted-foreground mt-1">
            Order {po.order_date}
            {po.expected_date && ` · Expected ${po.expected_date}`}
            {` · Gudang ${(po.warehouses as { code: string } | null)?.code}`}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-mono uppercase px-2 py-1 border ${statusColor[po.status] || ""}`}>{po.status}</span>
          {outstanding && po.status !== "cancelled" && (
            <Button className="gap-2" onClick={() => setReceiveOpen(true)}>
              <PackageCheck className="size-4" /> Terima barang
            </Button>
          )}
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-background mb-6">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border text-left">
            <tr>
              <th className="px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground">#</th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground">Produk</th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground text-right">Qty</th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground text-right">Diterima</th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground text-right">Harga</th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground text-right">PPN %</th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines?.map((l) => {
              const p = l.products as { sku: string; name: string; units: { code: string } | null } | null;
              const remaining = Number(l.quantity) - Number(l.quantity_received);
              return (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{l.line_no}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p?.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{p?.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{Number(l.quantity).toLocaleString("id-ID", { maximumFractionDigits: 4 })} <span className="text-[10px] text-muted-foreground">{p?.units?.code}</span></td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums ${remaining > 0 ? "text-amber-700" : "text-green-700"}`}>
                    {Number(l.quantity_received).toLocaleString("id-ID", { maximumFractionDigits: 4 })}
                    {remaining > 0 && <div className="text-[10px] text-muted-foreground">−{remaining.toLocaleString("id-ID", { maximumFractionDigits: 4 })}</div>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{Number(l.unit_price).toLocaleString("id-ID", { maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right font-mono text-muted-foreground">{Number(l.tax_pct)}%</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{Number(l.line_total).toLocaleString("id-ID", { maximumFractionDigits: 2 })}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-surface border-t border-border">
            <tr>
              <td colSpan={6} className="px-4 py-2 text-right text-xs text-muted-foreground">Subtotal</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">{Number(po.subtotal).toLocaleString("id-ID", { maximumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td colSpan={6} className="px-4 py-2 text-right text-xs text-muted-foreground">Pajak</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">{Number(po.tax_total).toLocaleString("id-ID", { maximumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td colSpan={6} className="px-4 py-2 text-right font-bold">Total</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums font-bold">{Number(po.grand_total).toLocaleString("id-ID", { maximumFractionDigits: 2 })} {po.currency}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {po.notes && (
        <div className="mb-6">
          <div className="font-mono text-[10px] uppercase text-muted-foreground mb-1">Catatan</div>
          <div className="text-sm border border-border rounded p-3 bg-surface/40">{po.notes}</div>
        </div>
      )}

      <h3 className="font-bold mb-3 text-sm font-mono uppercase tracking-widest text-muted-foreground">Penerimaan barang</h3>
      {(receipts?.length ?? 0) === 0 ? (
        <div className="text-sm text-muted-foreground border border-dashed border-border rounded p-6 text-center">
          Belum ada penerimaan.
        </div>
      ) : (
        <div className="space-y-3">
          {receipts?.map((r) => (
            <div key={r.id} className="border border-border rounded p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-mono text-xs font-medium">{r.gr_no}</div>
                <div className="text-xs text-muted-foreground">{new Date(r.receipt_date).toLocaleString("id-ID")}</div>
              </div>
              <div className="text-xs space-y-1">
                {(r.goods_receipt_lines as Array<{ quantity: number; products: { sku: string; name: string } | null }>).map((gl, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{gl.products?.name} <span className="font-mono text-muted-foreground">({gl.products?.sku})</span></span>
                    <span className="font-mono tabular-nums">+{Number(gl.quantity).toLocaleString("id-ID", { maximumFractionDigits: 4 })}</span>
                  </div>
                ))}
              </div>
              {r.supplier_ref && <div className="text-[10px] text-muted-foreground mt-2">Ref supplier: {r.supplier_ref}</div>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <ReceiveDialog poId={poId} companyId={companyId} lines={lines ?? []} onDone={() => setReceiveOpen(false)} />
      </Dialog>
    </div>
  );
}

type LineRow = {
  id: string; product_id: string;
  quantity: number; quantity_received: number; unit_price: number;
  products: { sku: string; name: string; units: { code: string } | null } | null;
};

function ReceiveDialog({ poId, companyId, lines, onDone }: {
  poId: string; companyId: string | null | undefined; lines: LineRow[]; onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [supplierRef, setSupplierRef] = useState("");
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    lines.forEach((l) => {
      const remaining = Number(l.quantity) - Number(l.quantity_received);
      if (remaining > 0) initial[l.id] = String(remaining);
    });
    return initial;
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No active company");
      const payload = lines
        .map((l) => ({
          po_line_id: l.id,
          product_id: l.product_id,
          quantity: Number(qty[l.id] || 0),
          unit_cost: Number(l.unit_price) || 0,
        }))
        .filter((r) => r.quantity > 0);
      if (payload.length === 0) throw new Error("Tidak ada qty untuk diterima");
      const { error } = await supabase.rpc("create_goods_receipt", {
        _company_id: companyId,
        _purchase_order_id: poId,
        _supplier_ref: supplierRef || (null as unknown as string),
        _notes: notes || (null as unknown as string),
        _lines: payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Penerimaan barang berhasil dicatat");
      queryClient.invalidateQueries();
      onDone();
      navigate({ to: "/app/purchasing/orders/$poId", params: { poId } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menerima barang"),
  });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Terima barang</DialogTitle></DialogHeader>
      <div className="border border-border rounded overflow-hidden mb-3">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border text-left">
            <tr>
              <th className="px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">Produk</th>
              <th className="px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground text-right">Sisa</th>
              <th className="px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground text-right w-32">Terima</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const remaining = Number(l.quantity) - Number(l.quantity_received);
              return (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.products?.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{l.products?.sku}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{remaining.toLocaleString("id-ID", { maximumFractionDigits: 4 })} <span className="text-[10px] text-muted-foreground">{l.products?.units?.code}</span></td>
                  <td className="px-3 py-2">
                    <Input
                      type="number" step="0.0001" min="0" max={remaining}
                      className="h-8 text-right font-mono"
                      value={qty[l.id] ?? ""}
                      onChange={(e) => setQty({ ...qty, [l.id]: e.target.value })}
                      disabled={remaining <= 0}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Ref. supplier (No. Surat Jalan)</Label><Input value={supplierRef} onChange={(e) => setSupplierRef(e.target.value)} /></div>
        <div><Label>Catatan</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Batal</Button>
        <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
          {submit.isPending ? "Memproses…" : "Post penerimaan"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
