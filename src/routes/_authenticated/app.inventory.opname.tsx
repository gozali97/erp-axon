import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/inventory/opname")({
  component: OpnamePage,
});

function OpnamePage() {
  const { data: companyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [counts, setCounts] = useState<Record<string, string>>({});

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses-opname", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("warehouses").select("id, code, name")
        .eq("company_id", companyId!).eq("is_active", true).order("name");
      return data ?? [];
    },
  });

  const { data: rows } = useQuery({
    queryKey: ["opname-sheet", companyId, warehouseId],
    enabled: !!companyId && !!warehouseId,
    queryFn: async () => {
      // Left-join: all active stockable products, plus current balance in this warehouse
      const { data: products } = await supabase
        .from("products").select("id, sku, name, units(code)")
        .eq("company_id", companyId!).eq("is_active", true).eq("product_type", "stockable")
        .order("name").limit(1000);
      const { data: balances } = await supabase
        .from("stock_balances").select("product_id, quantity_on_hand, average_cost")
        .eq("company_id", companyId!).eq("warehouse_id", warehouseId);
      const byProduct = new Map<string, { qty: number; cost: number }>(
        (balances ?? []).map((b) => [b.product_id, { qty: Number(b.quantity_on_hand), cost: Number(b.average_cost) }])
      );
      return (products ?? []).map((p) => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        unit: (p.units as { code: string } | null)?.code ?? "",
        system_qty: byProduct.get(p.id)?.qty ?? 0,
        avg_cost: byProduct.get(p.id)?.cost ?? 0,
      }));
    },
  });

  const diffs = useMemo(() => {
    if (!rows) return [];
    return rows
      .map((r) => {
        const counted = counts[r.id];
        if (counted === undefined || counted === "") return null;
        const c = Number(counted);
        if (Number.isNaN(c)) return null;
        const delta = c - r.system_qty;
        if (delta === 0) return null;
        return { ...r, counted: c, delta };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [rows, counts]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!companyId || !warehouseId) throw new Error("Pilih gudang");
      if (diffs.length === 0) throw new Error("Tidak ada selisih untuk di-post");
      for (const d of diffs) {
        const { error } = await supabase.rpc("post_stock_adjustment", {
          _company_id: companyId,
          _warehouse_id: warehouseId,
          _product_id: d.id,
          _delta: d.delta,
          _unit_cost: d.avg_cost,
          _notes: `Stock opname: sistem ${d.system_qty}, fisik ${d.counted}`,
          _source: "opname",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`Opname berhasil: ${diffs.length} penyesuaian di-post`);
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock-balances"] });
      queryClient.invalidateQueries({ queryKey: ["opname-sheet"] });
      setCounts({});
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal memposting opname"),
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-end gap-4 mb-6">
        <div className="w-80">
          <Label>Gudang untuk opname</Label>
          <Select value={warehouseId} onValueChange={(v) => { setWarehouseId(v); setCounts({}); }}>
            <SelectTrigger><SelectValue placeholder="Pilih gudang" /></SelectTrigger>
            <SelectContent>
              {warehouses?.map((w) => (
                <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {warehouseId && (
          <div className="flex-1 flex items-center justify-between gap-4">
            <div className="text-xs text-muted-foreground">
              Kosongkan qty fisik untuk baris yang tidak dihitung. Hanya baris dengan selisih yang di-post sebagai adjustment (source: opname).
            </div>
            <Button
              onClick={() => submit.mutate()}
              disabled={diffs.length === 0 || submit.isPending}
              className="gap-2"
            >
              <ClipboardCheck className="size-4" />
              Post {diffs.length} selisih
            </Button>
          </div>
        )}
      </div>

      {!warehouseId && (
        <div className="border border-dashed border-border rounded-lg p-16 text-center text-muted-foreground text-sm">
          Pilih gudang untuk memulai sesi opname.
        </div>
      )}

      {warehouseId && (
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr className="text-left">
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">SKU</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Produk</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Qty Sistem</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right w-40">Qty Fisik</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {rows?.map((r) => {
                const counted = counts[r.id];
                const cNum = counted === "" || counted === undefined ? null : Number(counted);
                const delta = cNum === null || Number.isNaN(cNum) ? null : cNum - r.system_qty;
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="px-4 py-3 font-mono text-xs">{r.sku}</td>
                    <td className="px-4 py-3">{r.name}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {r.system_qty.toLocaleString("id-ID", { maximumFractionDigits: 4 })}
                      <span className="text-[10px] text-muted-foreground ml-1">{r.unit}</span>
                    </td>
                    <td className="px-4 py-3">
                      <Input
                        type="number" step="0.0001"
                        value={counted ?? ""}
                        onChange={(e) => setCounts({ ...counts, [r.id]: e.target.value })}
                        className="h-8 text-right font-mono tabular-nums"
                        placeholder="—"
                      />
                    </td>
                    <td className={`px-4 py-3 text-right font-mono tabular-nums ${delta === null ? "text-muted-foreground" : delta === 0 ? "" : delta > 0 ? "text-green-700" : "text-red-700"}`}>
                      {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toLocaleString("id-ID", { maximumFractionDigits: 4 })}`}
                    </td>
                  </tr>
                );
              })}
              {rows?.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-16 text-center text-muted-foreground">Belum ada produk stockable.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
