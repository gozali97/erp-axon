import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/hr/departments")({
  component: DepartmentsPage,
});

function DepartmentsPage() {
  const { data: companyId } = useActiveCompany();
  const [openDept, setOpenDept] = useState(false);
  const [openPos, setOpenPos] = useState(false);

  const { data: departments } = useQuery({
    queryKey: ["hr-departments", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("*").eq("company_id", companyId!).order("code");
      if (error) throw error;
      return data;
    },
  });

  const { data: positions } = useQuery({
    queryKey: ["hr-positions", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("positions").select("*, departments(name)").eq("company_id", companyId!).order("code");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Departments</h2>
          <Dialog open={openDept} onOpenChange={setOpenDept}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="size-4" /> Department</Button>
            </DialogTrigger>
            <DeptDialog companyId={companyId} onDone={() => setOpenDept(false)} />
          </Dialog>
        </div>
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr className="text-left">
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Kode</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Nama</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {(departments?.length ?? 0) === 0 && (
                <tr><td colSpan={3} className="px-4 py-12 text-center text-muted-foreground"><Building2 className="mx-auto size-8 mb-2" />Belum ada department</td></tr>
              )}
              {departments?.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                  <td className="px-4 py-3 font-mono text-xs">{d.code}</td>
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3 text-xs">{d.is_active ? "Active" : "Inactive"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Positions</h2>
          <Dialog open={openPos} onOpenChange={setOpenPos}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2"><Plus className="size-4" /> Position</Button>
            </DialogTrigger>
            <PosDialog companyId={companyId} departments={departments ?? []} onDone={() => setOpenPos(false)} />
          </Dialog>
        </div>
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr className="text-left">
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Kode</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Jabatan</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Department</th>
                <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Level</th>
              </tr>
            </thead>
            <tbody>
              {(positions?.length ?? 0) === 0 && (
                <tr><td colSpan={4} className="px-4 py-12 text-center text-muted-foreground">Belum ada position</td></tr>
              )}
              {positions?.map((p: any) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                  <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
                  <td className="px-4 py-3 font-medium">{p.title}</td>
                  <td className="px-4 py-3 text-xs">{p.departments?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">{p.level ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function DeptDialog({ companyId, onDone }: { companyId?: string | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ code: "", name: "" });
  const mut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      const { error } = await supabase.from("departments").insert({ company_id: companyId, code: form.code, name: form.name });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-departments"] });
      toast.success("Department dibuat");
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Department baru</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Kode</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="HR" /></div>
        <div><Label>Nama</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Human Resources" /></div>
      </div>
      <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.code || !form.name}>Simpan</Button></DialogFooter>
    </DialogContent>
  );
}

function PosDialog({ companyId, departments, onDone }: { companyId?: string | null; departments: any[]; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ code: "", title: "", department_id: "", level: "" });
  const mut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      const { error } = await supabase.from("positions").insert({
        company_id: companyId, code: form.code, title: form.title,
        department_id: form.department_id || null, level: form.level || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-positions"] });
      toast.success("Position dibuat");
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Position baru</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Kode</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="MGR" /></div>
        <div><Label>Jabatan</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Manager" /></div>
        <div>
          <Label>Department</Label>
          <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
            <option value="">— pilih —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div><Label>Level (opsional)</Label><Input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="Staff / Supervisor / Manager" /></div>
      </div>
      <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.code || !form.title}>Simpan</Button></DialogFooter>
    </DialogContent>
  );
}
