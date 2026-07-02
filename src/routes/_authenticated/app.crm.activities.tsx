import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Phone, Mail, Calendar, StickyNote, CheckSquare, Check, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/crm/activities")({
  component: ActivitiesPage,
});

const typeIcon: Record<string, any> = {
  call: Phone, email: Mail, meeting: Calendar, note: StickyNote, task: CheckSquare,
};

function ActivitiesPage() {
  const { data: companyId } = useActiveCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: activities } = useQuery({
    queryKey: ["activities", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_activities")
        .select("*, leads(name), opportunities(name), customers(name)")
        .eq("company_id", companyId!).order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const complete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_activities").update({ completed_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activities"] }); toast.success("Marked complete"); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_activities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activities"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-7xl mx-auto px-8 py-10">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-bold">Activities</h2>
          <p className="text-sm text-muted-foreground">Calls, emails, meetings and tasks</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="w-4 h-4 mr-1" /> Log Activity</Button></DialogTrigger>
          <NewActivityDialog companyId={companyId!} onClose={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="space-y-2">
        {activities?.map((a: any) => {
          const Icon = typeIcon[a.activity_type] || StickyNote;
          const done = !!a.completed_at;
          const overdue = !done && a.due_at && new Date(a.due_at) < new Date();
          return (
            <div key={a.id} className={`border border-border rounded p-3 flex items-start gap-3 ${done ? "opacity-60" : ""}`}>
              <Icon className={`w-4 h-4 mt-1 ${overdue ? "text-red-500" : "text-muted-foreground"}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${done ? "line-through" : ""}`}>{a.subject}</span>
                  <span className="text-[10px] font-mono uppercase text-muted-foreground">{a.activity_type}</span>
                </div>
                {a.description && <div className="text-xs text-muted-foreground mt-0.5">{a.description}</div>}
                <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-3">
                  {a.leads?.name && <span>Lead: {a.leads.name}</span>}
                  {a.opportunities?.name && <span>Opp: {a.opportunities.name}</span>}
                  {a.customers?.name && <span>Customer: {a.customers.name}</span>}
                  {a.due_at && <span className={overdue ? "text-red-500" : ""}>Due: {new Date(a.due_at).toLocaleString()}</span>}
                  {done && <span className="text-emerald-600">✓ Completed</span>}
                </div>
              </div>
              <div className="flex gap-1">
                {!done && <Button size="sm" variant="outline" onClick={() => complete.mutate(a.id)}><Check className="w-3 h-3" /></Button>}
                <Button size="sm" variant="ghost" onClick={() => del.mutate(a.id)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            </div>
          );
        })}
        {!activities?.length && (
          <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded">
            <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-50" /> No activities logged
          </div>
        )}
      </div>
    </div>
  );
}

function NewActivityDialog({ companyId, onClose }: { companyId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    activity_type: "call", subject: "", description: "",
    lead_id: "", opportunity_id: "", customer_id: "", due_at: "",
  });

  const { data: leads } = useQuery({
    queryKey: ["leads-lite", companyId],
    queryFn: async () => (await supabase.from("leads").select("id, name").eq("company_id", companyId).order("name")).data,
  });
  const { data: opps } = useQuery({
    queryKey: ["opps-lite", companyId],
    queryFn: async () => (await supabase.from("opportunities").select("id, name").eq("company_id", companyId).order("name")).data,
  });
  const { data: customers } = useQuery({
    queryKey: ["customers-lite", companyId],
    queryFn: async () => (await supabase.from("customers").select("id, name").eq("company_id", companyId).order("name")).data,
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crm_activities").insert({
        company_id: companyId,
        activity_type: form.activity_type as any,
        subject: form.subject,
        description: form.description || null,
        lead_id: form.lead_id || null,
        opportunity_id: form.opportunity_id || null,
        customer_id: form.customer_id || null,
        due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["activities"] }); toast.success("Logged"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Log Activity</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={form.activity_type} onValueChange={(v) => setForm({ ...form, activity_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["call","email","meeting","note","task"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Due Date/Time</Label><Input type="datetime-local" value={form.due_at} onChange={(e) => setForm({ ...form, due_at: e.target.value })} /></div>
        </div>
        <div><Label>Subject *</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
        <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Lead</Label>
            <Select value={form.lead_id} onValueChange={(v) => setForm({ ...form, lead_id: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{leads?.map((l: any) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Opportunity</Label>
            <Select value={form.opportunity_id} onValueChange={(v) => setForm({ ...form, opportunity_id: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{opps?.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Customer</Label>
            <Select value={form.customer_id} onValueChange={(v) => setForm({ ...form, customer_id: v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>{customers?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button disabled={!form.subject || create.isPending} onClick={() => create.mutate()}>Save</Button>
      </DialogFooter>
    </DialogContent>
  );
}
