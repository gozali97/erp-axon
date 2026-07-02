import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Play, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/hr/payroll")({
  component: PayrollPage,
});

const fmt = new Intl.NumberFormat("id-ID");
const now = new Date();

function PayrollPage() {
  const { data: companyId } = useActiveCompany();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const { data: runs } = useQuery({
    queryKey: ["hr-payrolls", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("payroll_runs").select("*").eq("company_id", companyId!).order("period_year", { ascending: false }).order("period_month", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: lines } = useQuery({
    queryKey: ["hr-payroll-lines", selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error } = await supabase.from("payroll_lines").select("*, employees(employee_no, full_name)").eq("payroll_run_id", selected!).order("employee_id");
      if (error) throw error;
      return data;
    },
  });

  const postMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("post_payroll_run", { _company_id: companyId!, _run_id: id, _cash_account_code: "1110", _mark_paid: true });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-payrolls"] }); toast.success("Payroll dipost & jurnal dibuat"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="p-8 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-mono uppercase tracking-widest text-muted-foreground">Payroll Runs</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-2"><Plus className="size-4" /> Baru</Button></DialogTrigger>
            <CreateRunDialog companyId={companyId} onDone={() => setOpen(false)} />
          </Dialog>
        </div>
        <div className="border border-border rounded-lg bg-background divide-y divide-border">
          {(runs?.length ?? 0) === 0 && <div className="p-6 text-center text-sm text-muted-foreground">Belum ada payroll</div>}
          {runs?.map((r: any) => (
            <button key={r.id} onClick={() => setSelected(r.id)} className={`w-full text-left p-3 hover:bg-surface/50 flex items-center justify-between ${selected === r.id ? "bg-surface" : ""}`}>
              <div>
                <div className="font-mono text-xs">{r.run_no}</div>
                <div className="text-sm font-medium">{String(r.period_month).padStart(2, "0")}/{r.period_year}</div>
                <div className="text-[10px] font-mono uppercase text-muted-foreground">{r.status} • Rp {fmt.format(r.total_net)}</div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-2">
        {!selected && <div className="border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">Pilih payroll run untuk melihat detail</div>}
        {selected && (() => {
          const run = runs?.find((r: any) => r.id === selected);
          if (!run) return null;
          return (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-mono text-xs text-muted-foreground">{run.run_no}</div>
                  <h3 className="text-lg font-bold">Periode {String(run.period_month).padStart(2, "0")}/{run.period_year}</h3>
                  <div className="text-xs text-muted-foreground">Pay date: {run.pay_date}</div>
                </div>
                {run.status === "draft" && (
                  <Button onClick={() => postMut.mutate(run.id)} disabled={postMut.isPending} className="gap-2"><Play className="size-4" /> Post & bayar</Button>
                )}
                {run.status !== "draft" && <div className="text-xs font-mono uppercase px-2 py-1 rounded bg-green-500/10 text-green-600">{run.status}</div>}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="border border-border rounded-lg p-3"><div className="text-[10px] font-mono uppercase text-muted-foreground">Gross</div><div className="font-mono text-sm">Rp {fmt.format(run.total_gross)}</div></div>
                <div className="border border-border rounded-lg p-3"><div className="text-[10px] font-mono uppercase text-muted-foreground">Deductions</div><div className="font-mono text-sm">Rp {fmt.format(run.total_deductions)}</div></div>
                <div className="border border-border rounded-lg p-3"><div className="text-[10px] font-mono uppercase text-muted-foreground">Net</div><div className="font-mono text-sm font-bold">Rp {fmt.format(run.total_net)}</div></div>
              </div>

              <div className="border border-border rounded-lg overflow-hidden bg-background">
                <table className="w-full text-sm">
                  <thead className="bg-surface border-b border-border">
                    <tr className="text-left">
                      <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Karyawan</th>
                      <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Gaji</th>
                      <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Tunjangan</th>
                      <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Potongan</th>
                      <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines?.map((l: any) => (
                      <tr key={l.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 text-sm">{l.employees?.full_name}<div className="text-[10px] font-mono text-muted-foreground">{l.employees?.employee_no}</div></td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{fmt.format(l.base_salary)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{fmt.format(l.allowance)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{fmt.format(l.deduction)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs font-bold">{fmt.format(l.net_pay)}</td>
                      </tr>
                    ))}
                    {(lines?.length ?? 0) === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Tidak ada line</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

function CreateRunDialog({ companyId, onDone }: { companyId?: string | null; onDone: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    period_year: now.getFullYear(),
    period_month: now.getMonth() + 1,
    pay_date: new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10),
    notes: "",
  });
  const mut = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      const { error } = await supabase.rpc("create_payroll_run", {
        _company_id: companyId,
        _period_year: form.period_year,
        _period_month: form.period_month,
        _pay_date: form.pay_date,
        _notes: form.notes || "",
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["hr-payrolls"] }); toast.success("Payroll run dibuat"); onDone(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Payroll Run baru</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Tahun</Label><Input type="number" value={form.period_year} onChange={(e) => setForm({ ...form, period_year: Number(e.target.value) })} /></div>
        <div><Label>Bulan</Label><Input type="number" min={1} max={12} value={form.period_month} onChange={(e) => setForm({ ...form, period_month: Number(e.target.value) })} /></div>
        <div className="col-span-2"><Label>Pay date</Label><Input type="date" value={form.pay_date} onChange={(e) => setForm({ ...form, pay_date: e.target.value })} /></div>
        <div className="col-span-2"><Label>Catatan</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={() => mut.mutate()} disabled={mut.isPending}>Generate</Button></DialogFooter>
    </DialogContent>
  );
}
