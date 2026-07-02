import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/hr/attendance")({
  component: AttendancePage,
});

function AttendancePage() {
  const { data: companyId } = useActiveCompany();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [open, setOpen] = useState(false);

  const { data: rows } = useQuery({
    queryKey: ["hr-attendance", companyId, date],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendances")
        .select("*, employees(employee_no, full_name)")
        .eq("company_id", companyId!)
        .eq("attendance_date", date)
        .order("employee_id");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Label className="text-xs uppercase font-mono">Tanggal</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-auto" />
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="size-4" /> Catat absensi</Button></DialogTrigger>
          <AttendanceDialog companyId={companyId} defaultDate={date} onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr className="text-left">
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">NIK</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Nama</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Masuk</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Pulang</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Jam kerja</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Lembur</th>
            </tr>
          </thead>
          <tbody>
            {(rows?.length ?? 0) === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Belum ada absensi untuk tanggal ini</td></tr>}
            {rows?.map((r: any) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                <td className="px-4 py-3 font-mono text-xs">{r.employees?.employee_no}</td>
                <td className="px-4 py-3 font-medium">{r.employees?.full_name}</td>
                <td className="px-4 py-3 text-xs uppercase">{r.status}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.clock_in ? new Date(r.clock_in).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.clock_out ? new Date(r.clock_out).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">{Number(r.work_hours).toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">{Number(r.overtime_hours).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttendanceDialog({ companyId, defaultDate, onDone }: { companyId?: string | null; defaultDate: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    employee_id: "", attendance_date: defaultDate, status: "present",
    clock_in: "08:00", clock_out: "17:00", overtime_hours: 0, notes: "",
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
      const ci = form.clock_in ? new Date(`${form.attendance_date}T${form.clock_in}:00`).toISOString() : null;
      const co = form.clock_out ? new Date(`${form.attendance_date}T${form.clock_out}:00`).toISOString() : null;
      let hours = 0;
      if (ci && co) hours = Math.max(0, (new Date(co).getTime() - new Date(ci).getTime()) / 3600000);
      const { error } = await supabase.from("attendances").insert({
        company_id: companyId,
        employee_id: form.employee_id,
        attendance_date: form.attendance_date,
        status: form.status as any,
        clock_in: ci, clock_out: co,
        work_hours: hours,
        overtime_hours: form.overtime_hours,
        notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-attendance"] });
      toast.success("Absensi disimpan");
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Catat absensi</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div>
          <Label>Karyawan</Label>
          <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
            <option value="">— pilih —</option>
            {employees?.map((e: any) => <option key={e.id} value={e.id}>{e.employee_no} — {e.full_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Tanggal</Label><Input type="date" value={form.attendance_date} onChange={(e) => setForm({ ...form, attendance_date: e.target.value })} /></div>
          <div>
            <Label>Status</Label>
            <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option value="present">Hadir</option>
              <option value="late">Terlambat</option>
              <option value="absent">Alpha</option>
              <option value="leave">Cuti</option>
              <option value="holiday">Libur</option>
            </select>
          </div>
          <div><Label>Jam masuk</Label><Input type="time" value={form.clock_in} onChange={(e) => setForm({ ...form, clock_in: e.target.value })} /></div>
          <div><Label>Jam pulang</Label><Input type="time" value={form.clock_out} onChange={(e) => setForm({ ...form, clock_out: e.target.value })} /></div>
          <div><Label>Lembur (jam)</Label><Input type="number" step="0.5" value={form.overtime_hours} onChange={(e) => setForm({ ...form, overtime_hours: Number(e.target.value) })} /></div>
        </div>
        <div><Label>Catatan</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.employee_id}>Simpan</Button></DialogFooter>
    </DialogContent>
  );
}
