import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/sales/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const { data: companyId } = useActiveCompany();
  const [open, setOpen] = useState(false);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers").select("*")
        .eq("company_id", companyId!).order("name").limit(500);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">Master data pelanggan.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="size-4" /> Customer baru</Button>
          </DialogTrigger>
          <CreateCustomerDialog companyId={companyId} onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr className="text-left">
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Kode</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Nama</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">NPWP</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Kontak</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Term</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Memuat…</td></tr>}
            {!isLoading && (customers?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-16 text-center">
                  <Users className="mx-auto size-8 text-muted-foreground mb-3" />
                  <div className="font-medium mb-1">Belum ada customer</div>
                  <Button onClick={() => setOpen(true)} size="sm" className="mt-2 gap-2"><Plus className="size-4" /> Tambah customer</Button>
                </td>
              </tr>
            )}
            {customers?.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                <td className="px-4 py-3 font-medium">{c.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{c.tax_id || "—"}</td>
                <td className="px-4 py-3 text-xs">
                  <div>{c.email || "—"}</div>
                  <div className="text-muted-foreground">{c.phone || ""}</div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">NET {c.payment_terms_days}</td>
                <td className="px-4 py-3">
                  {c.is_active ? (
                    <span className="text-[10px] font-mono uppercase text-green-700 bg-green-50 px-2 py-0.5 border border-green-200">Active</span>
                  ) : (
                    <span className="text-[10px] font-mono uppercase text-muted-foreground bg-surface px-2 py-0.5 border border-border">Inactive</span>
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

function CreateCustomerDialog({ companyId, onDone }: { companyId: string | null | undefined; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [f, setF] = useState({
    code: "", name: "", tax_id: "", email: "", phone: "", address: "",
    payment_terms_days: "30", credit_limit: "0", currency: "IDR", notes: "", is_active: true,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No active company");
      if (!f.code.trim() || !f.name.trim()) throw new Error("Kode dan nama wajib diisi");
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase.from("customers").insert({
        company_id: companyId,
        code: f.code.trim().toUpperCase(),
        name: f.name.trim(),
        tax_id: f.tax_id.trim() || null,
        email: f.email.trim() || null,
        phone: f.phone.trim() || null,
        address: f.address.trim() || null,
        payment_terms_days: Number(f.payment_terms_days) || 30,
        credit_limit: Number(f.credit_limit) || 0,
        currency: f.currency,
        notes: f.notes.trim() || null,
        is_active: f.is_active,
        created_by: user.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer berhasil dibuat");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal membuat customer"),
  });

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>Customer baru</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Kode *</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="CUST-001" /></div>
        <div><Label>NPWP</Label><Input value={f.tax_id} onChange={(e) => setF({ ...f, tax_id: e.target.value })} /></div>
        <div className="col-span-2"><Label>Nama *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div><Label>Telepon</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div className="col-span-2"><Label>Alamat</Label><Textarea rows={2} value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
        <div><Label>Termin (hari)</Label><Input type="number" min="0" value={f.payment_terms_days} onChange={(e) => setF({ ...f, payment_terms_days: e.target.value })} /></div>
        <div><Label>Limit kredit</Label><Input type="number" min="0" value={f.credit_limit} onChange={(e) => setF({ ...f, credit_limit: e.target.value })} /></div>
        <div><Label>Mata uang</Label><Input value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} /></div>
        <div className="col-span-2 flex items-center gap-2">
          <Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} />
          <Label>Aktif</Label>
        </div>
        <div className="col-span-2"><Label>Catatan</Label><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Batal</Button>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? "Menyimpan…" : "Simpan customer"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
