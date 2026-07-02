import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Truck, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/sales/orders/$soId")({
  component: SOPage,
});

const statusColor: Record<string, string> = {
  draft: "text-muted-foreground bg-surface border-border",
  submitted: "text-blue-700 bg-blue-50 border-blue-200",
  approved: "text-indigo-700 bg-indigo-50 border-indigo-200",
  partial: "text-amber-700 bg-amber-50 border-amber-200",
  delivered: "text-green-700 bg-green-50 border-green-200",
  closed: "text-muted-foreground bg-surface border-border",
  cancelled: "text-red-700 bg-red-50 border-red-200",
};

type LineRow = {
  id: string; product_id: string;
  quantity: number; quantity_delivered: number; quantity_invoiced: number; unit_price: number;
  discount_pct: number; tax_pct: number; line_no: number; line_total: number;
  products: { sku: string; name: string; units: { code: string } | null } | null;
};

function SOPage() {
  const { soId } = Route.useParams();
  const { data: companyId } = useActiveCompany();
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);

  const { data: so } = useQuery({
    queryKey: ["so", soId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales_orders")
        .select("*, customers(*), warehouses(code, name)")
        .eq("id", soId).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: lines } = useQuery({
    queryKey: ["so-lines", soId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_order_lines")
        .select("*, products(sku, name, units(code))")
        .eq("sales_order_id", soId).order("line_no");
      return (data ?? []) as unknown as LineRow[];
    },
  });

  const { data: deliveries } = useQuery({
    queryKey: ["so-deliveries", soId],
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_orders")
        .select("id, do_no, delivery_date, carrier, tracking_no, notes, delivery_order_lines(quantity, products(sku, name))")
        .eq("sales_order_id", soId).order("delivery_date", { ascending: false });
      return data ?? [];
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["so-invoices", soId],
    queryFn: async () => {
      const { data } = await supabase
        .from("customer_invoices")
        .select("id, invoice_no, invoice_date, due_date, status, grand_total, currency")
        .eq("sales_order_id", soId).order("invoice_date", { ascending: false });
      return data ?? [];
    },
  });

  const outstandingDeliver = useMemo(() => (lines ?? []).some((l) => Number(l.quantity_delivered) < Number(l.quantity)), [lines]);
  const outstandingInvoice = useMemo(() => (lines ?? []).some((l) => Number(l.quantity_invoiced) < Number(l.quantity)), [lines]);

  if (!so) return <div className="p-8 text-muted-foreground">Memuat…</div>;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link to="/app/sales" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="size-3.5" /> Kembali
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="font-mono text-xs text-muted-foreground mb-1">{so.so_no}</div>
          <h2 className="text-2xl font-extrabold tracking-tight">
            {(so.customers as { name: string } | null)?.name}
          </h2>
          <div className="text-sm text-muted-foreground mt-1">
            Order {so.order_date}
            {so.expected_date && ` · Expected ${so.expected_date}`}
            {` · Gudang ${(so.warehouses as { code: string } | null)?.code}`}
            {so.customer_ref && ` · Ref ${so.customer_ref}`}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-mono uppercase px-2 py-1 border ${statusColor[so.status] || ""}`}>{so.status}</span>
          {outstandingDeliver && so.status !== "cancelled" && (
            <Button className="gap-2" onClick={() => setDeliverOpen(true)}>
              <Truck className="size-4" /> Kirim
            </Button>
          )}
          {outstandingInvoice && so.status !== "cancelled" && (
            <Button variant="outline" className="gap-2" onClick={() => setInvoiceOpen(true)}>
              <FileText className="size-4" /> Buat invoice
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
              <th className="px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground text-right">Dikirim</th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground text-right">Ditagih</th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground text-right">Harga</th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground text-right">PPN %</th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {lines?.map((l) => {
              const p = l.products;
              const remD = Number(l.quantity) - Number(l.quantity_delivered);
              const remI = Number(l.quantity) - Number(l.quantity_invoiced);
              return (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{l.line_no}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p?.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{p?.sku}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{Number(l.quantity).toLocaleString("id-ID", { maximumFractionDigits: 4 })} <span className="text-[10px] text-muted-foreground">{p?.units?.code}</span></td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums ${remD > 0 ? "text-amber-700" : "text-green-700"}`}>
                    {Number(l.quantity_delivered).toLocaleString("id-ID", { maximumFractionDigits: 4 })}
                    {remD > 0 && <div className="text-[10px] text-muted-foreground">−{remD.toLocaleString("id-ID", { maximumFractionDigits: 4 })}</div>}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono tabular-nums ${remI > 0 ? "text-amber-700" : "text-green-700"}`}>
                    {Number(l.quantity_invoiced).toLocaleString("id-ID", { maximumFractionDigits: 4 })}
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
              <td colSpan={7} className="px-4 py-2 text-right text-xs text-muted-foreground">Subtotal</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">{Number(so.subtotal).toLocaleString("id-ID", { maximumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td colSpan={7} className="px-4 py-2 text-right text-xs text-muted-foreground">Pajak</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums">{Number(so.tax_total).toLocaleString("id-ID", { maximumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td colSpan={7} className="px-4 py-2 text-right font-bold">Total</td>
              <td className="px-4 py-2 text-right font-mono tabular-nums font-bold">{Number(so.grand_total).toLocaleString("id-ID", { maximumFractionDigits: 2 })} {so.currency}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {so.notes && (
        <div className="mb-6">
          <div className="font-mono text-[10px] uppercase text-muted-foreground mb-1">Catatan</div>
          <div className="text-sm border border-border rounded p-3 bg-surface/40">{so.notes}</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="font-bold mb-3 text-sm font-mono uppercase tracking-widest text-muted-foreground">Pengiriman</h3>
          {(deliveries?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed border-border rounded p-6 text-center">Belum ada pengiriman.</div>
          ) : (
            <div className="space-y-3">
              {deliveries?.map((d) => (
                <div key={d.id} className="border border-border rounded p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-mono text-xs font-medium">{d.do_no}</div>
                    <div className="text-xs text-muted-foreground">{new Date(d.delivery_date).toLocaleString("id-ID")}</div>
                  </div>
                  <div className="text-xs space-y-1">
                    {(d.delivery_order_lines as Array<{ quantity: number; products: { sku: string; name: string } | null }>).map((dl, i) => (
                      <div key={i} className="flex justify-between">
                        <span>{dl.products?.name} <span className="font-mono text-muted-foreground">({dl.products?.sku})</span></span>
                        <span className="font-mono tabular-nums">−{Number(dl.quantity).toLocaleString("id-ID", { maximumFractionDigits: 4 })}</span>
                      </div>
                    ))}
                  </div>
                  {(d.carrier || d.tracking_no) && (
                    <div className="text-[10px] text-muted-foreground mt-2">
                      {d.carrier && `Kurir: ${d.carrier}`}{d.tracking_no && ` · ${d.tracking_no}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-bold mb-3 text-sm font-mono uppercase tracking-widest text-muted-foreground">Invoice</h3>
          {(invoices?.length ?? 0) === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed border-border rounded p-6 text-center">Belum ada invoice.</div>
          ) : (
            <div className="space-y-3">
              {invoices?.map((inv) => (
                <div key={inv.id} className="border border-border rounded p-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="font-mono text-xs font-medium">{inv.invoice_no}</div>
                    <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border ${statusColor[inv.status] || ""}`}>{inv.status}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {inv.invoice_date}{inv.due_date && ` · jatuh tempo ${inv.due_date}`}
                  </div>
                  <div className="text-sm font-mono tabular-nums text-right font-bold">
                    {Number(inv.grand_total).toLocaleString("id-ID", { maximumFractionDigits: 2 })} {inv.currency}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Dialog open={deliverOpen} onOpenChange={setDeliverOpen}>
        <DeliverDialog soId={soId} companyId={companyId} lines={lines ?? []} onDone={() => setDeliverOpen(false)} />
      </Dialog>
      <Dialog open={invoiceOpen} onOpenChange={setInvoiceOpen}>
        <InvoiceDialog soId={soId} companyId={companyId} lines={lines ?? []} termDays={(so.customers as { payment_terms_days: number } | null)?.payment_terms_days ?? 30} onDone={() => setInvoiceOpen(false)} />
      </Dialog>
    </div>
  );
}

function DeliverDialog({ soId, companyId, lines, onDone }: {
  soId: string; companyId: string | null | undefined; lines: LineRow[]; onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [carrier, setCarrier] = useState("");
  const [trackingNo, setTrackingNo] = useState("");
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    lines.forEach((l) => {
      const remaining = Number(l.quantity) - Number(l.quantity_delivered);
      if (remaining > 0) initial[l.id] = String(remaining);
    });
    return initial;
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No active company");
      const payload = lines
        .map((l) => ({
          so_line_id: l.id,
          product_id: l.product_id,
          quantity: Number(qty[l.id] || 0),
        }))
        .filter((r) => r.quantity > 0);
      if (payload.length === 0) throw new Error("Tidak ada qty untuk dikirim");
      const { error } = await supabase.rpc("create_delivery_order", {
        _company_id: companyId,
        _sales_order_id: soId,
        _carrier: carrier || (null as unknown as string),
        _tracking_no: trackingNo || (null as unknown as string),
        _notes: notes || (null as unknown as string),
        _lines: payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pengiriman berhasil dicatat");
      queryClient.invalidateQueries();
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal mengirim"),
  });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Kirim barang</DialogTitle></DialogHeader>
      <div className="border border-border rounded overflow-hidden mb-3">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border text-left">
            <tr>
              <th className="px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">Produk</th>
              <th className="px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground text-right">Sisa</th>
              <th className="px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground text-right w-32">Kirim</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const remaining = Number(l.quantity) - Number(l.quantity_delivered);
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
        <div><Label>Kurir</Label><Input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="JNE / GoSend / …" /></div>
        <div><Label>No. Resi</Label><Input value={trackingNo} onChange={(e) => setTrackingNo(e.target.value)} /></div>
        <div className="col-span-2"><Label>Catatan</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Batal</Button>
        <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
          {submit.isPending ? "Memproses…" : "Post pengiriman"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function InvoiceDialog({ soId, companyId, lines, termDays, onDone }: {
  soId: string; companyId: string | null | undefined; lines: LineRow[]; termDays: number; onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + termDays);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    lines.forEach((l) => {
      const remaining = Number(l.quantity) - Number(l.quantity_invoiced);
      if (remaining > 0) initial[l.id] = String(remaining);
    });
    return initial;
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No active company");
      const payload = lines
        .map((l) => ({
          so_line_id: l.id,
          product_id: l.product_id,
          description: null,
          quantity: Number(qty[l.id] || 0),
          unit_price: Number(l.unit_price),
          discount_pct: Number(l.discount_pct) || 0,
          tax_pct: Number(l.tax_pct) || 0,
        }))
        .filter((r) => r.quantity > 0);
      if (payload.length === 0) throw new Error("Tidak ada qty untuk ditagih");
      const { error } = await supabase.rpc("create_customer_invoice", {
        _company_id: companyId,
        _sales_order_id: soId,
        _invoice_date: invoiceDate,
        _due_date: dueDate || (null as unknown as string),
        _notes: notes || (null as unknown as string),
        _lines: payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invoice berhasil dibuat");
      queryClient.invalidateQueries();
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal membuat invoice"),
  });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Buat invoice</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div><Label>Tanggal invoice</Label><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></div>
        <div><Label>Jatuh tempo</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
      </div>
      <div className="border border-border rounded overflow-hidden mb-3">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border text-left">
            <tr>
              <th className="px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground">Produk</th>
              <th className="px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground text-right">Sisa</th>
              <th className="px-3 py-2 font-mono text-[10px] uppercase text-muted-foreground text-right w-32">Tagih</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const remaining = Number(l.quantity) - Number(l.quantity_invoiced);
              return (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <div className="font-medium">{l.products?.name}</div>
                    <div className="font-mono text-[10px] text-muted-foreground">{l.products?.sku}</div>
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums">{remaining.toLocaleString("id-ID", { maximumFractionDigits: 4 })}</td>
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
      <div><Label>Catatan</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Batal</Button>
        <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
          {submit.isPending ? "Memproses…" : "Terbitkan invoice"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
