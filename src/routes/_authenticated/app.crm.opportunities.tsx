import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Target, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/crm/opportunities")({
  component: OppsPage,
});

const STAGES = ["prospecting","qualification","proposal","negotiation","won","lost"] as const;
const stageColor: Record<string, string> = {
  prospecting: "border-slate-400",
  qualification: "border-blue-400",
  proposal: "border-amber-400",
  negotiation: "border-orange-400",
  won: "border-emerald-500",
  lost: "border-red-400",
};

function OppsPage() {
  const { data: companyId } = useActiveCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: opps } = useQuery({
    queryKey: ["opportunities", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunities")
        .select("*, customers(name)")
        .eq("company_id", companyId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const setStage = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: string }) => {
      const patch: any = { stage };
      if (stage === "won" || stage === "lost") patch.actual_close_date = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from("opportunities").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["opportunities"] }); toast.success("Stage updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("opportunities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["opportunities"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const grouped = STAGES.map(s => ({ stage: s, items: (opps || []).filter((o: any) => o.stage === s) }));
  const totalWeighted = (opps || []).filter((o: any) => !["won","lost"].includes(o.stage))
    .reduce((sum: number, o: any) => sum + Number(o.amount || 0) * (Number(o.probability || 0) / 100), 0);
  const totalWon = (opps || []).filter((o: any) => o.stage === "won").reduce((s: number, o: any) => s + Number(o.amount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold">Opportunities</h2>
          <p className="text-sm text-muted-foreground">Kanban pipeline by stage</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Opportunity</Button></DialogTrigger>
          <NewOppDialog companyId={companyId!} onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="border border-border rounded p-3">
          <div className="text-xs uppercase text-muted-foreground">Weighted Pipeline</div>
          <div className="text-lg font-bold">Rp {totalWeighted.toLocaleString()}</div>
        </div>
        <div className="border border-border rounded p-3">
          <div className="text-xs uppercase text-muted-foreground">Won</div>
          <div className="text-lg font-bold text-emerald-600">Rp {totalWon.toLocaleString()}</div>
        </div>
        <div className="border border-border rounded p-3">
          <div className="text-xs uppercase text-muted-foreground">Open</div>
          <div className="text-lg font-bold">{(opps || []).filter((o: any) => !["won","lost"].includes(o.stage)).length}</div>
        </div>
        <div className="border border-border rounded p-3">
          <div className="text-xs uppercase text-muted-foreground">Total</div>
          <div className="text-lg font-bold">{opps?.length || 0}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {grouped.map(col => (
          <div key={col.stage} className={`border-t-2 ${stageColor[col.stage]} bg-muted/30 rounded p-2 min-h-[200px]`}>
            <div className="text-xs font-mono uppercase font-bold mb-2 flex justify-between">
              <span>{col.stage}</span>
              <span className="text-muted-foreground">{col.items.length}</span>
            </div>
            <div className="space-y-2">
              {col.items.map((o: any) => (
                <div key={o.id} className="bg-background border border-border rounded p-2 text-xs">
                  <div className="font-medium truncate">{o.name}</div>
                  <div className="text-muted-foreground truncate">{o.customers?.name || "—"}</div>
                  <div className="mt-1 font-mono">Rp {Number(o.amount).toLocaleString()}</div>
                  <div className="text-muted-foreground">{o.probability}% probability</div>
                  <div className="mt-2 flex gap-1">
                    <Select value={o.stage} onValueChange={(v) => setStage.mutate({ id: o.id, stage: v })}>
                      <SelectTrigger className="h-6 text-[10px] flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => del.mutate(o.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
              {!col.items.length && (
                <div className="text-center text-[10px] text-muted-foreground py-4">
                  <Target className="w-4 h-4 mx-auto opacity-40" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NewOppDialog({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", customer_id: "", amount: "0", probability: "10", expected_close_date: "", notes: "" });

  const { data: customers } = useQuery({
    queryKey: ["customers-opp", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name").eq("company_id", companyId).order("name");
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("opportunities").insert({
        company_id: companyId,
        name: form.name,
        customer_id: form.customer_id || null,
        amount: Number(form.amount) || 0,
        probability: Number(form.probability) || 0,
        expected_close_date: form.expected_close_date || null,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["opportunities"] }); toast.success("Opportunity created"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New Opportunity</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div>
          <Label>Customer</Label>
          <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select customer (optional)" /></SelectTrigger>
            <SelectContent>
              {customers?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
          <div><Label>Probability %</Label><Input type="number" min="0" max="100" value={form.probability} onChange={(e) => setForm({ ...form, probability: e.target.value })} /></div>
        </div>
        <div><Label>Expected Close Date</Label><Input type="date" value={form.expected_close_date} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value })} /></div>
        <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!form.name || create.isPending} onClick={() => create.mutate()}>Create</Button>
      </DialogFooter>
    </DialogContent>
  );
}
