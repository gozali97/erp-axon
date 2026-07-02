import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Minus, Trash2, Search, ScanLine, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/pos/")({
  component: PosTerminal,
});

type CartLine = {
  product_id: string;
  sku: string;
  name: string;
  quantity: number;
  unit_price: number;
  discount_pct: number;
  tax_pct: number;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);

function PosTerminal() {
  const { data: companyId } = useActiveCompany();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [customerId, setCustomerId] = useState<string>("walkin");
  const [method, setMethod] = useState<"cash" | "card" | "transfer" | "qris" | "other">("cash");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [reference, setReference] = useState<string>("");
  const [cashAcct, setCashAcct] = useState<string>("1100");
  const [note, setNote] = useState<string>("");

  const { data: warehouses } = useQuery({
    queryKey: ["pos-warehouses", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("warehouses")
        .select("id, code, name, is_default")
        .eq("company_id", companyId!)
        .order("is_default", { ascending: false });
      if (error) throw error;
      if (data?.length && !warehouseId) setWarehouseId(data[0].id);
      return data;
    },
  });

  const { data: customers } = useQuery({
    queryKey: ["pos-customers", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, code, name")
        .eq("company_id", companyId!)
        .eq("is_active", true)
        .order("name")
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["pos-products", companyId, search],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select("id, sku, name, sale_price")
        .eq("company_id", companyId!)
        .eq("is_active", true)
        .order("name")
        .limit(30);
      if (search.trim()) {
        q = q.or(`name.ilike.%${search}%,sku.ilike.%${search}%,barcode.ilike.%${search}%`);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const totals = useMemo(() => {
    let subtotal = 0, tax = 0;
    for (const l of cart) {
      const gross = l.quantity * l.unit_price;
      const afterDisc = gross * (1 - (l.discount_pct || 0) / 100);
      const t = afterDisc * (l.tax_pct || 0) / 100;
      subtotal += afterDisc;
      tax += t;
    }
    return { subtotal, tax, grand: subtotal + tax };
  }, [cart]);

  const paid = parseFloat(amountPaid) || 0;
  const change = Math.max(paid - totals.grand, 0);

  function addToCart(p: { id: string; sku: string; name: string; sale_price: number | null }) {
    setCart((c) => {
      const i = c.findIndex((x) => x.product_id === p.id);
      if (i >= 0) {
        const copy = [...c];
        copy[i] = { ...copy[i], quantity: copy[i].quantity + 1 };
        return copy;
      }
      return [
        ...c,
        {
          product_id: p.id,
          sku: p.sku,
          name: p.name,
          quantity: 1,
          unit_price: Number(p.sale_price ?? 0),
          discount_pct: 0,
          tax_pct: 0,
        },
      ];
    });
  }

  function updateLine(i: number, patch: Partial<CartLine>) {
    setCart((c) => c.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function removeLine(i: number) {
    setCart((c) => c.filter((_, idx) => idx !== i));
  }
  function clearCart() {
    setCart([]); setAmountPaid(""); setReference(""); setNote("");
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Perusahaan tidak aktif");
      if (!warehouseId) throw new Error("Pilih gudang");
      if (cart.length === 0) throw new Error("Keranjang kosong");
      if (paid <= 0) throw new Error("Masukkan jumlah bayar");
      if (paid < totals.grand)
        throw new Error("Pembayaran kurang dari total (POS memerlukan pembayaran penuh)");

      const { data, error } = await supabase.rpc("create_pos_sale", {
        _company_id: companyId,
        _warehouse_id: warehouseId,
        _customer_id: customerId === "walkin" ? null : customerId,
        _sale_date: new Date().toISOString().slice(0, 10),
        _lines: cart.map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          discount_pct: l.discount_pct,
          tax_pct: l.tax_pct,
          description: l.name,
        })),
        _payment_method: method,
        _amount_paid: totals.grand,
        _cash_account_code: cashAcct,
        _payment_reference: reference || null,
        _notes: note || null,
      } as never);
      if (error) throw error;
      return data as {
        invoice_no: string; grand_total: number; change: number; payment_no: string;
      };
    },
    onSuccess: (res) => {
      toast.success(`Transaksi ${res.invoice_no} berhasil. Kembalian: Rp ${fmt(change)}`);
      clearCart();
      qc.invalidateQueries({ queryKey: ["pos-history"] });
      qc.invalidateQueries({ queryKey: ["customer-invoices"] });
      qc.invalidateQueries({ queryKey: ["stock-balances"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-7xl mx-auto px-8 py-6 grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-6">
      {/* LEFT: product search + grid */}
      <div>
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama / SKU / barcode…"
            className="pl-9 h-11"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {(products ?? []).map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="border border-border rounded-lg p-3 text-left bg-background hover:border-primary hover:bg-primary/5 transition-colors"
            >
              <div className="font-mono text-[10px] text-muted-foreground uppercase">{p.sku}</div>
              <div className="font-medium text-sm line-clamp-2 min-h-[40px]">{p.name}</div>
              <div className="mt-1 font-bold text-primary">Rp {fmt(Number(p.sale_price ?? 0))}</div>
            </button>
          ))}
          {(products?.length ?? 0) === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-12 border border-dashed border-border rounded-lg">
              <ScanLine className="size-8 mx-auto mb-2 opacity-40" />
              Tidak ada produk yang cocok.
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: cart + payment */}
      <div className="lg:sticky lg:top-20 self-start border border-border rounded-lg bg-background flex flex-col max-h-[calc(100vh-8rem)]">
        <div className="p-4 border-b border-border grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px] font-mono uppercase text-muted-foreground">Gudang</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="h-8"><SelectValue placeholder="Gudang" /></SelectTrigger>
              <SelectContent>
                {(warehouses ?? []).map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] font-mono uppercase text-muted-foreground">Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="walkin">Walk-in Customer</SelectItem>
                {(customers ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-2">
          {cart.length === 0 && (
            <div className="text-center text-muted-foreground py-12 text-sm">
              Klik produk untuk menambah ke keranjang.
            </div>
          )}
          {cart.map((l, i) => (
            <div key={l.product_id} className="p-3 border-b border-border last:border-0">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-[10px] text-muted-foreground">{l.sku}</div>
                  <div className="text-sm font-medium truncate">{l.name}</div>
                </div>
                <button onClick={() => removeLine(i)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </div>
              <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center mt-2">
                <div className="flex items-center border border-border rounded">
                  <button className="px-2 py-1 hover:bg-surface" onClick={() => updateLine(i, { quantity: Math.max(1, l.quantity - 1) })}>
                    <Minus className="size-3" />
                  </button>
                  <input
                    type="number"
                    className="w-12 text-center text-sm bg-transparent border-x border-border py-1"
                    value={l.quantity}
                    min={1}
                    onChange={(e) => updateLine(i, { quantity: Math.max(1, parseFloat(e.target.value) || 1) })}
                  />
                  <button className="px-2 py-1 hover:bg-surface" onClick={() => updateLine(i, { quantity: l.quantity + 1 })}>
                    <Plus className="size-3" />
                  </button>
                </div>
                <Input
                  type="number"
                  value={l.unit_price}
                  onChange={(e) => updateLine(i, { unit_price: parseFloat(e.target.value) || 0 })}
                  className="h-8 text-sm text-right"
                />
                <div className="text-sm font-bold w-24 text-right">
                  Rp {fmt(l.quantity * l.unit_price * (1 - (l.discount_pct || 0) / 100) * (1 + (l.tax_pct || 0) / 100))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div>
                  <Label className="text-[9px] font-mono uppercase text-muted-foreground">Disc %</Label>
                  <Input type="number" value={l.discount_pct} onChange={(e) => updateLine(i, { discount_pct: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
                </div>
                <div>
                  <Label className="text-[9px] font-mono uppercase text-muted-foreground">PPN %</Label>
                  <Input type="number" value={l.tax_pct} onChange={(e) => updateLine(i, { tax_pct: parseFloat(e.target.value) || 0 })} className="h-7 text-xs" />
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-border bg-surface/40 space-y-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>Rp {fmt(totals.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Pajak</span><span>Rp {fmt(totals.tax)}</span></div>
          <div className="flex justify-between text-lg font-extrabold border-t border-border pt-2">
            <span>TOTAL</span><span>Rp {fmt(totals.grand)}</span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <div>
              <Label className="text-[10px] font-mono uppercase text-muted-foreground">Metode</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Tunai</SelectItem>
                  <SelectItem value="card">Kartu</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="qris">QRIS</SelectItem>
                  <SelectItem value="other">Lain-lain</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] font-mono uppercase text-muted-foreground">Akun</Label>
              <Select value={cashAcct} onValueChange={setCashAcct}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1100">1100 — Kas</SelectItem>
                  <SelectItem value="1110">1110 — Bank</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-[10px] font-mono uppercase text-muted-foreground">Bayar</Label>
            <Input
              type="number"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              placeholder="0"
              className="h-10 text-lg font-bold text-right"
            />
          </div>

          {method !== "cash" && (
            <Input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Referensi (no. kartu/trx)"
              className="h-8"
            />
          )}

          {paid > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Kembalian</span>
              <span className={change > 0 ? "font-bold text-green-700" : ""}>Rp {fmt(change)}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={clearCart} disabled={cart.length === 0}>Batal</Button>
            <Button
              className="flex-1 gap-2 h-11"
              onClick={() => submit.mutate()}
              disabled={submit.isPending || cart.length === 0 || paid < totals.grand}
            >
              <CreditCard className="size-4" />
              {submit.isPending ? "Memproses…" : `Bayar Rp ${fmt(totals.grand)}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
