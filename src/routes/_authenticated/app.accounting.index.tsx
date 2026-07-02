import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/accounting/")({
  component: AccountsPage,
});

const TYPE_LABEL: Record<string, string> = {
  asset: "Aset", liability: "Kewajiban", equity: "Ekuitas", revenue: "Pendapatan", expense: "Beban",
};

function AccountsPage() {
  const { data: companyId } = useActiveCompany();
  const [open, setOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: accounts, isLoading } = useQuery({
    queryKey: ["accounts", companyId, typeFilter],
    enabled: !!companyId,
    queryFn: async () => {
      let q = supabase.from("accounts").select("*").eq("company_id", companyId!).order("code");
      if (typeFilter !== "all") q = q.eq("account_type", typeFilter as "asset");
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4">
        <p className="text-sm text-muted-foreground">Bagan akun. 24 akun standar sudah disiapkan otomatis untuk setiap perusahaan.</p>
        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua tipe</SelectItem>
              <SelectItem value="asset">Aset</SelectItem>
              <SelectItem value="liability">Kewajiban</SelectItem>
              <SelectItem value="equity">Ekuitas</SelectItem>
              <SelectItem value="revenue">Pendapatan</SelectItem>
              <SelectItem value="expense">Beban</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="size-4" /> Akun baru</Button>
            </DialogTrigger>
            <CreateAccountDialog companyId={companyId} onDone={() => setOpen(false)} />
          </Dialog>
        </div>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr className="text-left">
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Kode</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Nama</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Tipe</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Normal</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Kategori</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Memuat…</td></tr>}
            {!isLoading && (accounts?.length ?? 0) === 0 && (
              <tr><td colSpan={6} className="px-4 py-16 text-center">
                <BookOpen className="mx-auto size-8 text-muted-foreground mb-3" />
                <div className="font-medium">Belum ada akun</div>
              </td></tr>
            )}
            {accounts?.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                <td className="px-4 py-3 font-mono text-xs">{a.code}</td>
                <td className="px-4 py-3 font-medium">{a.name}</td>
                <td className="px-4 py-3 text-xs">{TYPE_LABEL[a.account_type]}</td>
                <td className="px-4 py-3 font-mono text-[10px] uppercase text-muted-foreground">{a.normal_balance}</td>
                <td className="px-4 py-3">
                  {a.is_group ? (
                    <span className="text-[10px] font-mono uppercase bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5">Group</span>
                  ) : (
                    <span className="text-[10px] font-mono uppercase text-muted-foreground">Postable</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {a.is_active
                    ? <span className="text-[10px] font-mono uppercase text-green-700 bg-green-50 px-2 py-0.5 border border-green-200">Active</span>
                    : <span className="text-[10px] font-mono uppercase text-muted-foreground bg-surface px-2 py-0.5 border border-border">Inactive</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateAccountDialog({ companyId, onDone }: { companyId: string | null | undefined; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [f, setF] = useState({
    code: "", name: "", account_type: "asset" as "asset" | "liability" | "equity" | "revenue" | "expense",
    normal_balance: "debit" as "debit" | "credit", is_group: false, is_active: true, description: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      if (!f.code.trim() || !f.name.trim()) throw new Error("Kode dan nama wajib");
      const { error } = await supabase.from("accounts").insert({
        company_id: companyId,
        code: f.code.trim(), name: f.name.trim(),
        account_type: f.account_type, normal_balance: f.normal_balance,
        is_group: f.is_group, is_active: f.is_active,
        description: f.description.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Akun dibuat");
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>Akun baru</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Kode *</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="1600" /></div>
        <div><Label>Tipe *</Label>
          <Select value={f.account_type} onValueChange={(v: "asset" | "liability" | "equity" | "revenue" | "expense") => setF({ ...f, account_type: v, normal_balance: (v === "asset" || v === "expense") ? "debit" : "credit" })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="asset">Aset</SelectItem>
              <SelectItem value="liability">Kewajiban</SelectItem>
              <SelectItem value="equity">Ekuitas</SelectItem>
              <SelectItem value="revenue">Pendapatan</SelectItem>
              <SelectItem value="expense">Beban</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label>Nama *</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><Label>Normal Balance</Label>
          <Select value={f.normal_balance} onValueChange={(v: "debit" | "credit") => setF({ ...f, normal_balance: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="debit">Debit</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 pt-6">
          <Switch checked={f.is_group} onCheckedChange={(v) => setF({ ...f, is_group: v })} />
          <Label>Group (header)</Label>
        </div>
        <div className="col-span-2"><Label>Deskripsi</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Batal</Button>
        <Button onClick={() => create.mutate()} disabled={create.isPending}>{create.isPending ? "Menyimpan…" : "Simpan"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
