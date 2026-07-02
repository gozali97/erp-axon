import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/hr/employees")({
  component: EmployeesPage,
});

const fmt = new Intl.NumberFormat("id-ID");

function EmployeesPage() {
  const { data: companyId } = useActiveCompany();
  const [open, setOpen] = useState(false);

  const { data: employees, isLoading } = useQuery({
    queryKey: ["hr-employees", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*, departments(name), positions(title)")
        .eq("company_id", companyId!)
        .order("employee_no");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">Data karyawan aktif dan non-aktif.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="size-4" /> Employee baru</Button>
          </DialogTrigger>
          <EmployeeDialog companyId={companyId} onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr className="text-left">
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">NIK</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Nama</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Department</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Jabatan</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Tipe</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Gaji</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Memuat…</td></tr>}
            {!isLoading && (employees?.length ?? 0) === 0 && (
              <tr><td colSpan={7} className="px-4 py-16 text-center">
                <Users className="mx-auto size-8 text-muted-foreground mb-3" />
                <div className="font-medium mb-1">Belum ada karyawan</div>
                <Button onClick={() => setOpen(true)} size="sm" className="mt-2 gap-2"><Plus className="size-4" /> Tambah karyawan</Button>
              </td></tr>
            )}
            {employees?.map((e: any) => (
              <tr key={e.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                <td className="px-4 py-3 font-mono text-xs">{e.employee_no}</td>
                <td className="px-4 py-3 font-medium">{e.full_name}<div className="text-xs text-muted-foreground">{e.email ?? ""}</div></td>
                <td className="px-4 py-3 text-xs">{e.departments?.name ?? "—"}</td>
                <td className="px-4 py-3 text-xs">{e.positions?.title ?? "—"}</td>
                <td className="px-4 py-3 text-xs uppercase">{e.employment_type}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">Rp {fmt.format(Number(e.base_salary) + Number(e.allowance_fixed))}</td>
                <td className="px-4 py-3 text-xs">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${e.employment_status === "active" ? "bg-green-500/10 text-green-600" : "bg-muted text-muted-foreground"}`}>
                    {e.employment_status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmployeeDialog({ companyId, onDone }: { companyId?: string | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    employee_no: "", full_name: "", email: "", phone: "",
    department_id: "", position_id: "",
    employment_type: "permanent", hire_date: new Date().toISOString().slice(0, 10),
    base_salary: 0, allowance_fixed: 0,
    bank_name: "", bank_account: "",
  });

  const { data: departments } = useQuery({
    queryKey: ["hr-departments", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("departments").select("id,name").eq("company_id", companyId!).eq("is_active", true).order("name");
      return data ?? [];
    },
  });
  const { data: positions } = useQuery({
    queryKey: ["hr-positions", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase.from("positions").select("id,title").eq("company_id", companyId!).eq("is_active", true).order("title");
      return data ?? [];
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      const { error } = await supabase.from("employees").insert({
        company_id: companyId,
        employee_no: form.employee_no,
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        department_id: form.department_id || null,
        position_id: form.position_id || null,
        employment_type: form.employment_type as any,
        hire_date: form.hire_date,
        base_salary: form.base_salary,
        allowance_fixed: form.allowance_fixed,
        bank_name: form.bank_name || null,
        bank_account: form.bank_account || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-employees"] });
      toast.success("Employee dibuat");
      onDone();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Karyawan baru</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>NIK / Nomor</Label><Input value={form.employee_no} onChange={(e) => setForm({ ...form, employee_no: e.target.value })} placeholder="EMP-001" /></div>
        <div><Label>Nama lengkap</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
        <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><Label>Telepon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div>
          <Label>Department</Label>
          <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}>
            <option value="">—</option>
            {departments?.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Jabatan</Label>
          <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" value={form.position_id} onChange={(e) => setForm({ ...form, position_id: e.target.value })}>
            <option value="">—</option>
            {positions?.map((p: any) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>
        <div>
          <Label>Tipe kerja</Label>
          <select className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm" value={form.employment_type} onChange={(e) => setForm({ ...form, employment_type: e.target.value })}>
            <option value="permanent">Permanent</option>
            <option value="contract">Contract</option>
            <option value="probation">Probation</option>
            <option value="intern">Intern</option>
            <option value="freelance">Freelance</option>
          </select>
        </div>
        <div><Label>Tanggal masuk</Label><Input type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} /></div>
        <div><Label>Gaji pokok (Rp)</Label><Input type="number" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: Number(e.target.value) })} /></div>
        <div><Label>Tunjangan tetap (Rp)</Label><Input type="number" value={form.allowance_fixed} onChange={(e) => setForm({ ...form, allowance_fixed: Number(e.target.value) })} /></div>
        <div><Label>Bank</Label><Input value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} /></div>
        <div><Label>No rekening</Label><Input value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending || !form.employee_no || !form.full_name}>Simpan</Button></DialogFooter>
    </DialogContent>
  );
}
