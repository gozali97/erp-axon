import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Play, CheckCircle2, XCircle, Factory } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/manufacturing/wo")({
  component: WorkOrdersPage,
});

const statusVariant: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  released: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  cancelled: "bg-red-500/10 text-red-600 dark:text-red-400",
};

function WorkOrdersPage() {
  const { data: companyId } = useActiveCompany();
  const qc = useQueryClient();
  const [openNew, setOpenNew] = useState(false);
  const [completeFor, setCompleteFor] = useState<any | null>(null);

  const { data: wos } = useQuery({
    queryKey: ["work-orders", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("*, products(sku, name), warehouses(code, name), bills_of_materials(code)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.rpc("set_work_order_status", {
        _company_id: companyId!,
        _wo_id: id,
        _status: status as any,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      toast.success("Status updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold">Work Orders</h2>
          <p className="text-sm text-muted-foreground">Production planning from BOM</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Work Order</Button>
          </DialogTrigger>
          <NewWoDialog companyId={companyId!} onClose={() => setOpenNew(false)} />
        </Dialog>
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">WO No</th>
              <th className="text-left px-4 py-2">Product</th>
              <th className="text-left px-4 py-2">Warehouse</th>
              <th className="text-right px-4 py-2">Planned</th>
              <th className="text-right px-4 py-2">Produced</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {wos?.map((wo: any) => (
              <tr key={wo.id} className="border-t border-border">
                <td className="px-4 py-2 font-mono">{wo.wo_no}</td>
                <td className="px-4 py-2">
                  <div className="font-medium">{wo.products?.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">{wo.products?.sku}</div>
                </td>
                <td className="px-4 py-2 text-xs">{wo.warehouses?.code}</td>
                <td className="px-4 py-2 text-right">{Number(wo.planned_qty).toLocaleString()}</td>
                <td className="px-4 py-2 text-right">{Number(wo.produced_qty).toLocaleString()}</td>
                <td className="px-4 py-2">
                  <Badge className={statusVariant[wo.status]} variant="outline">{wo.status}</Badge>
                </td>
                <td className="px-4 py-2 text-right space-x-1">
                  {wo.status === "draft" && (
                    <Button size="sm" variant="outline" onClick={() => setStatus.mutate({ id: wo.id, status: "released" })}>
                      <Play className="w-3 h-3 mr-1" /> Release
                    </Button>
                  )}
                  {(wo.status === "released" || wo.status === "in_progress") && (
                    <Button size="sm" onClick={() => setCompleteFor(wo)}>
                      <CheckCircle2 className="w-3 h-3 mr-1" /> Complete
                    </Button>
                  )}
                  {wo.status !== "completed" && wo.status !== "cancelled" && (
                    <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: wo.id, status: "cancelled" })}>
                      <XCircle className="w-3 h-3" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {!wos?.length && (
              <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">
                <Factory className="w-8 h-8 mx-auto mb-2 opacity-50" /> No work orders yet
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {completeFor && (
        <CompleteWoDialog wo={completeFor} companyId={companyId!} onClose={() => setCompleteFor(null)} />
      )}
    </div>
  );
}

function NewWoDialog({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [bomId, setBomId] = useState<string>("");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [plannedQty, setPlannedQty] = useState("1");
  const [plannedStart, setPlannedStart] = useState("");
  const [plannedEnd, setPlannedEnd] = useState("");
  const [notes, setNotes] = useState("");

  const { data: boms } = useQuery({
    queryKey: ["boms-active", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("bills_of_materials")
        .select("id, code, products(sku, name)")
        .eq("company_id", companyId).order("code");
      if (error) throw error;
      return data;
    },
  });
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("warehouses")
        .select("id, code, name").eq("company_id", companyId).order("code");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("create_work_order", {
        _company_id: companyId,
        _bom_id: bomId,
        _warehouse_id: warehouseId,
        _planned_qty: Number(plannedQty),
        _planned_start: plannedStart || (null as any),
        _planned_end: plannedEnd || (null as any),
        _notes: notes || (null as any),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      toast.success("Work order created");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New Work Order</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>BOM</Label>
          <Select value={bomId} onValueChange={setBomId}>
            <SelectTrigger><SelectValue placeholder="Select BOM" /></SelectTrigger>
            <SelectContent>
              {boms?.map((b: any) => (
                <SelectItem key={b.id} value={b.id}>{b.code} — {b.products?.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Warehouse</Label>
          <Select value={warehouseId} onValueChange={setWarehouseId}>
            <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
            <SelectContent>
              {warehouses?.map((w: any) => (
                <SelectItem key={w.id} value={w.id}>{w.code} — {w.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Planned Quantity</Label>
          <Input type="number" value={plannedQty} onChange={(e) => setPlannedQty(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Planned Start</Label>
            <Input type="date" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} />
          </div>
          <div>
            <Label>Planned End</Label>
            <Input type="date" value={plannedEnd} onChange={(e) => setPlannedEnd(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!bomId || !warehouseId || create.isPending} onClick={() => create.mutate()}>Create</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function CompleteWoDialog({ wo, companyId, onClose }: { wo: any; companyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [producedQty, setProducedQty] = useState(String(wo.planned_qty));
  const [notes, setNotes] = useState("");

  const { data: comps } = useQuery({
    queryKey: ["wo-comps", wo.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("work_order_components")
        .select("*, products(sku, name)")
        .eq("work_order_id", wo.id);
      if (error) throw error;
      return data;
    },
  });

  const complete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("complete_work_order", {
        _company_id: companyId,
        _wo_id: wo.id,
        _produced_qty: Number(producedQty),
        _notes: notes || (null as any),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["work-orders"] });
      qc.invalidateQueries({ queryKey: ["stock-balances"] });
      toast.success("Production posted");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Complete {wo.wo_no}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Produced Quantity</Label>
            <Input type="number" value={producedQty} onChange={(e) => setProducedQty(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Material Consumption</Label>
            <div className="border border-border rounded mt-1">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="text-left px-3 py-1">Component</th>
                    <th className="text-right px-3 py-1">Planned Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {comps?.map((c: any) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-3 py-1">
                        <div>{c.products?.name}</div>
                        <div className="text-xs font-mono text-muted-foreground">{c.products?.sku}</div>
                      </td>
                      <td className="px-3 py-1 text-right">{Number(c.planned_qty).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={complete.isPending} onClick={() => complete.mutate()}>Post Production</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
