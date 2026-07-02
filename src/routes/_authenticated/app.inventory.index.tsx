import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, AlertTriangle, Boxes } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/app/inventory/")({
  component: StockBalancesPage,
});

function StockBalancesPage() {
  const { data: companyId } = useActiveCompany();
  const [search, setSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState<string>("all");

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("warehouses")
        .select("id, code, name")
        .eq("company_id", companyId!)
        .eq("is_active", true)
        .order("name");
      return data ?? [];
    },
  });

  const { data: balances, isLoading } = useQuery({
    queryKey: ["stock-balances", companyId, warehouseId, search],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase
        .from("stock_balances")
        .select(
          "id, quantity_on_hand, quantity_reserved, average_cost, last_movement_at, warehouse_id, warehouses(code, name), products!inner(id, sku, name, min_stock, is_active, units(code))"
        )
        .eq("company_id", companyId!)
        .order("quantity_on_hand", { ascending: false })
        .limit(500);
      if (warehouseId !== "all") q = q.eq("warehouse_id", warehouseId);
      const { data, error } = await q;
      if (error) throw error;
      let rows = data ?? [];
      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter((r) => {
          const p = r.products as { sku: string; name: string } | null;
          return p && (p.sku.toLowerCase().includes(s) || p.name.toLowerCase().includes(s));
        });
      }
      return rows;
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari SKU atau nama produk…"
            className="pl-9"
          />
        </div>
        <Select value={warehouseId} onValueChange={setWarehouseId}>
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua gudang</SelectItem>
            {warehouses?.map((w) => (
              <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr className="text-left">
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">SKU</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Produk</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Gudang</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">On Hand</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Reserved</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Avg Cost</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Nilai Stok</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">Memuat…</td></tr>
            )}
            {!isLoading && (balances?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-16 text-center">
                  <Boxes className="mx-auto size-8 text-muted-foreground mb-3" />
                  <div className="font-medium mb-1">Belum ada saldo stok</div>
                  <div className="text-xs text-muted-foreground">Catat pergerakan pertama di tab Movements.</div>
                </td>
              </tr>
            )}
            {balances?.map((b) => {
              const p = b.products as { sku: string; name: string; min_stock: number; units: { code: string } | null } | null;
              const w = b.warehouses as { code: string; name: string } | null;
              const qty = Number(b.quantity_on_hand);
              const min = Number(p?.min_stock ?? 0);
              const low = min > 0 && qty <= min;
              const value = qty * Number(b.average_cost);
              return (
                <tr key={b.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                  <td className="px-4 py-3 font-mono text-xs">{p?.sku}</td>
                  <td className="px-4 py-3 font-medium">{p?.name}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{w?.code}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {qty.toLocaleString("id-ID", { maximumFractionDigits: 4 })}
                    <span className="text-[10px] text-muted-foreground ml-1">{p?.units?.code}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-muted-foreground">
                    {Number(b.quantity_reserved).toLocaleString("id-ID", { maximumFractionDigits: 4 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {Number(b.average_cost).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">
                    {value.toLocaleString("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3">
                    {low ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase text-amber-700 bg-amber-50 px-2 py-0.5 border border-amber-200">
                        <AlertTriangle className="size-3" /> Low
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono uppercase text-green-700 bg-green-50 px-2 py-0.5 border border-green-200">OK</span>
                    )}
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
