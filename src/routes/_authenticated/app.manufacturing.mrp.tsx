import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calculator, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/app/manufacturing/mrp")({
  component: MrpPage,
});

const fmt = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 4 });

function MrpPage() {
  const { data: companyId } = useActiveCompany();
  const [bomId, setBomId] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [targetQty, setTargetQty] = useState(1);
  const [runKey, setRunKey] = useState(0);

  const { data: boms } = useQuery({
    queryKey: ["boms-lite", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("bills_of_materials").select("id, code, version, products(name)").eq("company_id", companyId!).eq("is_active", true).order("code");
      return data ?? [];
    },
  });

  const { data: warehouses } = useQuery({
    queryKey: ["warehouses-lite", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("id,name").eq("company_id", companyId!).order("name");
      return data ?? [];
    },
  });

  const { data: result, isFetching, error } = useQuery({
    queryKey: ["mrp", runKey, bomId, warehouseId, targetQty],
    enabled: runKey > 0 && !!companyId && !!bomId && !!warehouseId && targetQty > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("calc_material_requirements", {
        _company_id: companyId!, _bom_id: bomId, _warehouse_id: warehouseId, _target_qty: targetQty,
      });
      if (error) throw error;
      return data;
    },
  });

  const anyShortage = (result ?? []).some((r: any) => Number(r.shortage) > 0);

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <p className="text-sm text-muted-foreground mb-6">Hitung kebutuhan bahan baku untuk produksi berdasarkan BOM dan stok gudang saat ini.</p>

      <div className="border border-border rounded-lg bg-background p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <Label>BOM</Label>
            <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" value={bomId} onChange={(e) => setBomId(e.target.value)}>
              <option value="">— pilih —</option>
              {boms?.map((b: any) => <option key={b.id} value={b.id}>{b.code} — {b.products?.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Gudang</Label>
            <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">— pilih —</option>
              {warehouses?.map((w: any) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <Label>Target produksi</Label>
            <Input type="number" step="1" value={targetQty} onChange={(e) => setTargetQty(Number(e.target.value))} />
          </div>
          <Button onClick={() => setRunKey((k) => k + 1)} disabled={!bomId || !warehouseId || targetQty <= 0} className="gap-2">
            <Calculator className="size-4" /> Hitung
          </Button>
        </div>
      </div>

      {error && <div className="text-sm text-red-600 mb-4">{(error as any).message}</div>}
      {isFetching && <div className="text-sm text-muted-foreground">Menghitung…</div>}

      {result && (
        <div>
          <div className={`flex items-center gap-2 mb-4 text-sm ${anyShortage ? "text-orange-600" : "text-green-600"}`}>
            {anyShortage ? <AlertTriangle className="size-4" /> : <CheckCircle2 className="size-4" />}
            <span className="font-medium">{anyShortage ? "Stok tidak mencukupi untuk beberapa komponen" : "Stok mencukupi untuk seluruh komponen"}</span>
          </div>

          <div className="border border-border rounded-lg overflow-hidden bg-background">
            <table className="w-full text-sm">
              <thead className="bg-surface border-b border-border">
                <tr className="text-left">
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">SKU</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Komponen</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Kebutuhan</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Stok</th>
                  <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Kurang</th>
                </tr>
              </thead>
              <tbody>
                {result.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">BOM tidak punya komponen</td></tr>}
                {result.map((r: any) => {
                  const short = Number(r.shortage) > 0;
                  return (
                    <tr key={r.component_product_id} className={`border-b border-border last:border-0 ${short ? "bg-orange-500/5" : ""}`}>
                      <td className="px-4 py-3 font-mono text-xs">{r.sku}</td>
                      <td className="px-4 py-3 font-medium">{r.name}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs">{fmt.format(Number(r.required_qty))}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">{fmt.format(Number(r.on_hand))}</td>
                      <td className={`px-4 py-3 text-right font-mono text-xs ${short ? "text-orange-600 font-bold" : "text-muted-foreground"}`}>
                        {short ? fmt.format(Number(r.shortage)) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
