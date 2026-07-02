import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/hr/leave")({
  component: LeavePage,
});

function LeavePage() {
  const { data: companyId } = useActiveCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: rows } = useQuery({
    queryKey: ["hr-leaves", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*, employees(employee_no, full_name)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const decide = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { data: userRes } = await supabase.auth.getUser();
      const { error } = await supabase.from("leave_requests").update({
        status, approved_by: userRes.user?.id, approved_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-leaves"] }); toast.success("Diperbarui"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">Pengajuan & persetujuan cuti.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="size-4" /> Ajukan cuti</Button></DialogTrigger>
          <LeaveDialog companyId={companyId} onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr className="text-left">
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">No</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Karyawan</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Jenis</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Periode</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Hari</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {(rows?.length ?? 0) === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Belum ada pengajuan</td></tr>}
            {rows?.map((r: any) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                <td className="px-4 py-3 font-mono text-xs">{r.request_no}</td>
                <td className="px-4 py-3">{r.employees?.full_name}<div className="text-xs text-muted-foreground">{r.employees?.employee_no}</div></td>
                <td className="px-4 py-3 text-xs uppercase">{r.leave_type}</td>
                <td className="px-4 py-3 text-xs">{r.start_date} → {r.end_date}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">{Number(r.days)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                    r.status === "approved" ? "bg-green-500/10 text-green-600" :
                    r.status === "rejected" ? "bg-red-500/10 text-red-600" :
                    "bg-muted text-muted-foreground"
                  }`}>{r.status}</span>
                </td>
                <td className="px-4 py-3 text-right">
                  {r.status === "submitted" && (
                    <div className="flex gap-1 justify-end">
                      <Button size="sm" variant="outline" className="h-7 px-2 gap-1" onClick={() => decide.mutate({ id: r.id, status: "approved" })}><Check className="size-3" /></Button>
                      <Button size="sm" variant="outline" className="h-7 px-2 gap-1" onClick={() => decide.mutate({ id: r.id, status: "rejected" })}><X className="size-3" /></Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LeaveDialog({ companyId, onDone }: { companyId?: string | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    employee_id: "", leave_type: "annual",
    start_date: new Date().toISOString().slice(0, 10),
    end_date: new Date().toISOString().slice(0, 10),
    reason: "",
  });

  const { data: employees } = useQuery({
    queryKey: ["hr-employees-lite", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id,employee_no,full_name").eq("company_id", companyId!).eq("employment_status", "active").order("full_name");
      return data ?? [];
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      const days = Math.max(1, Math.ceil((new Date(form.end_date).getTime() - new Date(form.start_date).getTime()) / 86400000) + 1);
      const request_no = `LV-${new Date().toISOString().slice(0, 7).replace("-", "")}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
      const { error } = await supabase.from("leave_requests").insert({
        company_id: companyId,
        request_no,
        employee_id: form.employee_id,
        leave_type: form.leave_type as any,
        start_date: form.start_date,
        end_date: form.end_date,
        days,
        reason: form.reason || null,
        status: "submitted",
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-leaves"] }); toast.success("Pengajuan dibuat"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Pengajuan cuti</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Karyawan</Label>
          <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
            <option value="">— pilih —</option>
            {employees?.map((e: any) => <option key={e.id} value={e.id}>{e.employee_no} — {e.full_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Jenis</Label>
            <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}>
              <option value="annual">Tahunan</option>
              <option value="sick">Sakit</option>
              <option value="maternity">Melahirkan</option>
              <option value="paternity">Ayah</option>
              <option value="unpaid">Tanpa gaji</option>
              <option value="other">Lain</option>
            </select>
          </div>
          <div></div>
          <div><Label>Mulai</Label><Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
          <div><Label>Selesai</Label><Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
        </div>
        <div><Label>Alasan</Label><Textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} /></div>
      </div>
      <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.employee_id}>Ajukan</Button></DialogFooter>
    </DialogContent>
  );
}
