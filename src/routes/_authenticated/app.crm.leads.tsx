import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, UserPlus, ArrowRightCircle, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/app/crm/leads")({
  component: LeadsPage,
});

const statusColor: Record<string, string> = {
  new: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  contacted: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  qualified: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  unqualified: "bg-red-500/10 text-red-600 dark:text-red-400",
  converted: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

function LeadsPage() {
  const { data: companyId } = useActiveCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [convertFor, setConvertFor] = useState<any | null>(null);

  const { data: leads } = useQuery({
    queryKey: ["leads", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*")
        .eq("company_id", companyId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("leads").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); toast.success("Status updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); toast.success("Lead deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold">Leads</h2>
          <p className="text-sm text-muted-foreground">Prospects entering your pipeline</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Lead</Button></DialogTrigger>
          <NewLeadDialog companyId={companyId!} onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="border border-border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2">Name</th>
              <th className="text-left px-4 py-2">Company</th>
              <th className="text-left px-4 py-2">Contact</th>
              <th className="text-left px-4 py-2">Source</th>
              <th className="text-right px-4 py-2">Est. Value</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-right px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leads?.map((l: any) => (
              <tr key={l.id} className="border-t border-border">
                <td className="px-4 py-2 font-medium">{l.name}</td>
                <td className="px-4 py-2">{l.company_name || "—"}</td>
                <td className="px-4 py-2 text-xs">
                  <div>{l.email || "—"}</div>
                  <div className="text-muted-foreground">{l.phone || ""}</div>
                </td>
                <td className="px-4 py-2 text-xs">{l.source || "—"}</td>
                <td className="px-4 py-2 text-right">{Number(l.estimated_value || 0).toLocaleString()}</td>
                <td className="px-4 py-2">
                  <Select value={l.status} onValueChange={(v) => setStatus.mutate({ id: l.id, status: v })} disabled={l.status === "converted"}>
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <Badge className={statusColor[l.status]} variant="outline">{l.status}</Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {["new","contacted","qualified","unqualified"].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-2 text-right space-x-1">
                  {l.status !== "converted" && (
                    <Button size="sm" variant="outline" onClick={() => setConvertFor(l)}>
                      <ArrowRightCircle className="w-3 h-3 mr-1" /> Convert
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => del.mutate(l.id)}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </td>
              </tr>
            ))}
            {!leads?.length && (
              <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">
                <UserPlus className="w-8 h-8 mx-auto mb-2 opacity-50" /> No leads yet
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {convertFor && <ConvertLeadDialog lead={convertFor} companyId={companyId!} onClose={() => setConvertFor(null)} />}
    </div>
  );
}

function NewLeadDialog({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", company_name: "", email: "", phone: "", source: "", estimated_value: "0", notes: "" });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").insert({
        company_id: companyId,
        name: form.name,
        company_name: form.company_name || null,
        email: form.email || null,
        phone: form.phone || null,
        source: form.source || null,
        estimated_value: Number(form.estimated_value) || 0,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leads"] }); toast.success("Lead added"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New Lead</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Contact Name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Company</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Source</Label><Input placeholder="Website, Referral..." value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
          <div><Label>Est. Value</Label><Input type="number" value={form.estimated_value} onChange={(e) => setForm({ ...form, estimated_value: e.target.value })} /></div>
        </div>
        <div><Label>Notes</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!form.name || create.isPending} onClick={() => create.mutate()}>Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function ConvertLeadDialog({ lead, companyId, onClose }: { lead: any; companyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [createOpp, setCreateOpp] = useState(true);

  const convert = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc("convert_lead", {
        _company_id: companyId,
        _lead_id: lead.id,
        _customer_code: code || (null as any),
        _create_opportunity: createOpp,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["opportunities"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Lead converted to customer");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Convert {lead.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Create a customer record and optional opportunity from this lead.</p>
          <div><Label>Customer Code (optional)</Label><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Auto-generated if blank" /></div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={createOpp} onChange={(e) => setCreateOpp(e.target.checked)} />
            Also create Opportunity in pipeline
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={convert.isPending} onClick={() => convert.mutate()}>Convert</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
