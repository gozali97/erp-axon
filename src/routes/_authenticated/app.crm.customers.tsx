import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Users, Search, Building2, Mail, Phone, ArrowLeft,
  Sparkles, Target, Activity, Receipt, Pencil, Power, Trash2, CheckCircle2, Circle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { z } from "zod";

const customerSchema = z.object({
  code: z.string().trim().min(1, "Kode wajib diisi").max(50, "Kode maks 50 karakter")
    .regex(/^[A-Za-z0-9._-]+$/, "Kode hanya huruf/angka/._-"),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(200, "Nama maks 200 karakter"),
  tax_id: z.string().trim().max(30, "NPWP maks 30 karakter").optional().or(z.literal("")),
  email: z.string().trim().max(255).email("Format email tidak valid").optional().or(z.literal("")),
  phone: z.string().trim().max(30, "Telepon maks 30 karakter")
    .regex(/^[0-9+\-\s()]*$/, "Telepon hanya angka dan + - ( )").optional().or(z.literal("")),
  address: z.string().trim().max(500, "Alamat maks 500 karakter").optional().or(z.literal("")),
  payment_terms_days: z.coerce.number().int("Harus bilangan bulat").min(0, "Tidak boleh negatif").max(365, "Maks 365 hari"),
  credit_limit: z.coerce.number().min(0, "Tidak boleh negatif").max(1e15, "Nilai terlalu besar"),
  currency: z.string().trim().length(3, "Kode mata uang 3 huruf").regex(/^[A-Z]{3}$/, "Huruf besar 3 karakter"),
  notes: z.string().trim().max(1000, "Catatan maks 1000 karakter").optional().or(z.literal("")),
  is_active: z.boolean(),
});

const activitySchema = z.object({
  activity_type: z.enum(["call", "email", "meeting", "note", "task"]),
  subject: z.string().trim().min(2, "Subject minimal 2 karakter").max(200, "Subject maks 200 karakter"),
  description: z.string().trim().max(1000, "Catatan maks 1000 karakter").optional().or(z.literal("")),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal YYYY-MM-DD").optional().or(z.literal("")),
  due_time: z.string().regex(/^\d{2}:\d{2}$/, "Format jam HH:MM").optional().or(z.literal("")),
}).refine((v) => !(v.due_time && !v.due_date), { message: "Isi tanggal bila jam diisi", path: ["due_date"] })
  .refine((v) => {
    if (!v.due_date) return true;
    const iso = `${v.due_date}T${v.due_time || "09:00"}`;
    const d = new Date(iso);
    return !Number.isNaN(d.getTime());
  }, { message: "Tanggal/jam tidak valid", path: ["due_date"] });

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-1">{msg}</p>;
}

export const Route = createFileRoute("/_authenticated/app/crm/customers")({
  component: CrmCustomersPage,
});

type CustomerRow = {
  id: string; code: string; name: string; tax_id: string | null;
  email: string | null; phone: string | null; address: string | null;
  payment_terms_days: number; credit_limit: number; currency: string;
  notes: string | null; is_active: boolean;
};

const idr = (n: number) =>
  new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n || 0);

function CrmCustomersPage() {
  const { data: companyId } = useActiveCompany();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [deleting, setDeleting] = useState<CustomerRow | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const { data: customers, isLoading } = useQuery({
    queryKey: ["crm-customers", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers").select("*")
        .eq("company_id", companyId!).order("name").limit(500);
      if (error) throw error;
      return data as CustomerRow[];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (c: CustomerRow) => {
      const { error } = await supabase.from("customers").update({ is_active: !c.is_active }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: (_d, c) => {
      toast.success(c.is_active ? "Customer dinonaktifkan" : "Customer diaktifkan");
      queryClient.invalidateQueries({ queryKey: ["crm-customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer", c.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal update"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Customer dihapus");
      setDeleting(null);
      if (selectedId === deleting?.id) setSelectedId(null);
      queryClient.invalidateQueries({ queryKey: ["crm-customers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal hapus (mungkin ada transaksi terkait)"),
  });

  const filtered = useMemo(() => {
    if (!customers) return [];
    const s = q.trim().toLowerCase();
    if (!s) return customers;
    return customers.filter((c) =>
      c.name?.toLowerCase().includes(s) ||
      c.code?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      c.phone?.toLowerCase().includes(s));
  }, [customers, q]);

  if (selectedId) {
    return (
      <>
        <CustomerDetail
          customerId={selectedId}
          onBack={() => setSelectedId(null)}
          onEdit={(c) => { setEditing(c); setFormOpen(true); }}
          onToggle={(c) => toggleActive.mutate(c)}
          onDelete={(c) => setDeleting(c)}
        />
        <CustomerFormDialog
          key={editing?.id ?? "new-in-detail"}
          open={formOpen}
          onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }}
          companyId={companyId}
          initial={editing}
        />
        <DeleteCustomerDialog
          customer={deleting}
          onOpenChange={(v) => !v && setDeleting(null)}
          onConfirm={() => deleting && remove.mutate(deleting.id)}
          pending={remove.isPending}
        />
      </>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6 gap-4">
        <p className="text-sm text-muted-foreground">
          Kelola pelanggan (individu & perusahaan) beserta rangkuman Leads, Opportunities, Activities, dan penjualan.
        </p>
        <Button className="gap-2" onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="size-4" /> Customer baru
        </Button>
      </div>

      <div className="mb-4 relative max-w-md">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, kode, email…" className="pl-9" />
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr className="text-left">
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Kode</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Nama</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Kontak</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Term</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground w-32"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Memuat…</td></tr>}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-16 text-center">
                <Users className="mx-auto size-8 text-muted-foreground mb-3" />
                <div className="font-medium mb-1">Belum ada customer</div>
                <Button onClick={() => { setEditing(null); setFormOpen(true); }} size="sm" className="mt-2 gap-2">
                  <Plus className="size-4" /> Tambah customer
                </Button>
              </td></tr>
            )}
            {filtered.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                <td className="px-4 py-3 font-mono text-xs">{c.code}</td>
                <td className="px-4 py-3">
                  <button onClick={() => setSelectedId(c.id)} className="font-medium flex items-center gap-2 hover:underline text-left">
                    <Building2 className="size-3.5 text-muted-foreground" />
                    {c.name}
                  </button>
                  {c.tax_id && <div className="text-xs text-muted-foreground font-mono">NPWP {c.tax_id}</div>}
                </td>
                <td className="px-4 py-3 text-xs">
                  {c.email && <div className="flex items-center gap-1"><Mail className="size-3" /> {c.email}</div>}
                  {c.phone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="size-3" /> {c.phone}</div>}
                  {!c.email && !c.phone && <span className="text-muted-foreground">—</span>}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs">NET {c.payment_terms_days}</td>
                <td className="px-4 py-3">
                  {c.is_active
                    ? <span className="text-[10px] font-mono uppercase text-green-700 bg-green-50 px-2 py-0.5 border border-green-200">Active</span>
                    : <span className="text-[10px] font-mono uppercase text-muted-foreground bg-surface px-2 py-0.5 border border-border">Inactive</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => setSelectedId(c.id)}>Detail</Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="size-8"><MoreHorizontal className="size-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => { setEditing(c); setFormOpen(true); }}>
                          <Pencil className="size-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive.mutate(c)}>
                          <Power className="size-4 mr-2" /> {c.is_active ? "Nonaktifkan" : "Aktifkan"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleting(c)} className="text-destructive focus:text-destructive">
                          <Trash2 className="size-4 mr-2" /> Hapus
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CustomerFormDialog
        key={editing?.id ?? "new"}
        open={formOpen}
        onOpenChange={(v) => { setFormOpen(v); if (!v) setEditing(null); }}
        companyId={companyId}
        initial={editing}
      />
      <DeleteCustomerDialog
        customer={deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        pending={remove.isPending}
      />
    </div>
  );
}

function CustomerDetail({
  customerId, onBack, onEdit, onToggle, onDelete,
}: {
  customerId: string; onBack: () => void;
  onEdit: (c: CustomerRow) => void;
  onToggle: (c: CustomerRow) => void;
  onDelete: (c: CustomerRow) => void;
}) {
  const { data: companyId } = useActiveCompany();
  const [activityOpen, setActivityOpen] = useState(false);

  const { data: customer } = useQuery({
    queryKey: ["customer", customerId],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").eq("id", customerId).maybeSingle();
      if (error) throw error;
      return data as CustomerRow | null;
    },
  });

  const { data: leads } = useQuery({
    queryKey: ["customer-leads", customerId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*")
        .eq("company_id", companyId!).eq("converted_customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: opps } = useQuery({
    queryKey: ["customer-opps", customerId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("opportunities").select("*")
        .eq("company_id", companyId!).eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: activities } = useQuery({
    queryKey: ["customer-activities", customerId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_activities").select("*")
        .eq("company_id", companyId!).eq("customer_id", customerId)
        .order("due_at", { ascending: false, nullsFirst: false }).limit(50);
      if (error) throw error;
      return data;
    },
  });

  const { data: invoices } = useQuery({
    queryKey: ["customer-invoices", customerId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_invoices").select("id, invoice_no, invoice_date, grand_total, amount_paid, status")
        .eq("company_id", companyId!).eq("customer_id", customerId)
        .order("invoice_date", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
  });

  const totalPipeline = (opps ?? []).filter((o) => !["won", "lost"].includes(o.stage))
    .reduce((s, o) => s + Number(o.amount || 0), 0);
  const totalWon = (opps ?? []).filter((o) => o.stage === "won")
    .reduce((s, o) => s + Number(o.amount || 0), 0);
  const totalBilled = (invoices ?? []).reduce((s, i) => s + Number(i.grand_total || 0), 0);
  const totalPaid = (invoices ?? []).reduce((s, i) => s + Number(i.amount_paid || 0), 0);
  const openTasks = (activities ?? []).filter((a) => !a.completed_at).length;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 -ml-2 mb-4">
          <ArrowLeft className="size-4" /> Kembali ke Customers
        </Button>
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
              {customer?.code}
            </div>
            <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
              <Building2 className="size-6" />
              {customer?.name ?? "…"}
              {customer && !customer.is_active && (
                <span className="text-[10px] font-mono uppercase text-muted-foreground bg-surface px-2 py-0.5 border border-border">Inactive</span>
              )}
            </h2>
            <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {customer?.email && <span className="flex items-center gap-1"><Mail className="size-3.5" /> {customer.email}</span>}
              {customer?.phone && <span className="flex items-center gap-1"><Phone className="size-3.5" /> {customer.phone}</span>}
              {customer?.tax_id && <span className="font-mono">NPWP {customer.tax_id}</span>}
            </div>
            {customer?.address && <div className="text-sm text-muted-foreground mt-2 max-w-xl">{customer.address}</div>}
          </div>
          {customer && (
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => onEdit(customer)} className="gap-2">
                <Pencil className="size-4" /> Edit
              </Button>
              <Button size="sm" variant="outline" onClick={() => onToggle(customer)} className="gap-2">
                <Power className="size-4" /> {customer.is_active ? "Nonaktifkan" : "Aktifkan"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDelete(customer)} className="gap-2 text-destructive hover:text-destructive">
                <Trash2 className="size-4" /> Hapus
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryTile icon={Sparkles} label="Leads terkonversi" value={String(leads?.length ?? 0)} />
        <SummaryTile icon={Target} label="Open pipeline" value={idr(totalPipeline)} sub={`${(opps ?? []).filter((o) => !["won","lost"].includes(o.stage)).length} opportunity`} />
        <SummaryTile icon={Activity} label="Open tasks" value={String(openTasks)} sub={`${activities?.length ?? 0} total`} />
        <SummaryTile icon={Receipt} label="Total dibayar" value={idr(totalPaid)} sub={`dari ${idr(totalBilled)}`} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Panel title="Leads" count={leads?.length ?? 0}>
          {(leads?.length ?? 0) === 0 ? <EmptyRow msg="Belum ada lead yang dikonversi menjadi customer ini." /> : (
            <ul className="divide-y divide-border">
              {leads!.map((l) => (
                <li key={l.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{l.name}</div>
                    <div className="text-xs text-muted-foreground">{l.source || "—"} · {new Date(l.created_at).toLocaleDateString("id-ID")}</div>
                  </div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-border bg-surface">{l.status}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Opportunities" count={opps?.length ?? 0} extra={<span className="text-xs text-muted-foreground">Won {idr(totalWon)}</span>}>
          {(opps?.length ?? 0) === 0 ? <EmptyRow msg="Belum ada opportunity." /> : (
            <ul className="divide-y divide-border">
              {opps!.map((o) => (
                <li key={o.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">{o.name}</div>
                    <div className="text-xs text-muted-foreground">Prob {o.probability ?? 0}% · {o.expected_close_date ? new Date(o.expected_close_date).toLocaleDateString("id-ID") : "—"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs">{idr(Number(o.amount || 0))}</div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-border bg-surface">{o.stage}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          title="Activities"
          count={activities?.length ?? 0}
          extra={
            <Button size="sm" variant="outline" onClick={() => setActivityOpen(true)} className="gap-1 h-7">
              <Plus className="size-3.5" /> Activity
            </Button>
          }
        >
          {(activities?.length ?? 0) === 0 ? <EmptyRow msg="Belum ada aktivitas." /> : (
            <ul className="divide-y divide-border">
              {activities!.slice(0, 15).map((a) => (
                <ActivityRow key={a.id} activity={a} customerId={customerId} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Invoices" count={invoices?.length ?? 0} extra={<span className="text-xs text-muted-foreground">{idr(totalBilled)}</span>}>
          {(invoices?.length ?? 0) === 0 ? <EmptyRow msg="Belum ada invoice." /> : (
            <ul className="divide-y divide-border">
              {invoices!.map((i) => (
                <li key={i.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-mono text-xs">{i.invoice_no}</div>
                    <div className="text-xs text-muted-foreground">{new Date(i.invoice_date).toLocaleDateString("id-ID")}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs">{idr(Number(i.grand_total || 0))}</div>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-border bg-surface">{i.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <ActivityFormDialog
        open={activityOpen}
        onOpenChange={setActivityOpen}
        companyId={companyId}
        customerId={customerId}
      />
    </div>
  );
}

function ActivityRow({ activity, customerId }: { activity: any; customerId: string }) {
  const queryClient = useQueryClient();
  const done = !!activity.completed_at;
  const overdue = !done && activity.due_at && new Date(activity.due_at) < new Date();

  const toggle = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crm_activities")
        .update({ completed_at: done ? null : new Date().toISOString() })
        .eq("id", activity.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-activities", customerId] });
      toast.success(done ? "Ditandai belum selesai" : "Aktivitas selesai");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal update"),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crm_activities").delete().eq("id", activity.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-activities", customerId] });
      toast.success("Aktivitas dihapus");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal hapus"),
  });

  return (
    <li className="py-2 flex items-center gap-3 text-sm">
      <button
        onClick={() => toggle.mutate()}
        disabled={toggle.isPending}
        className={`shrink-0 ${done ? "text-green-600" : "text-muted-foreground hover:text-foreground"}`}
        title={done ? "Tandai belum selesai" : "Tandai selesai"}
      >
        {done ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`font-medium truncate ${done ? "line-through text-muted-foreground" : ""}`}>{activity.subject}</div>
        <div className="text-xs text-muted-foreground">
          {activity.activity_type} · {activity.due_at ? new Date(activity.due_at).toLocaleString("id-ID") : "tanpa jadwal"}
          {overdue && <span className="ml-2 text-destructive font-mono uppercase text-[10px]">overdue</span>}
        </div>
      </div>
      <Button size="icon" variant="ghost" className="size-7 text-muted-foreground hover:text-destructive" onClick={() => remove.mutate()}>
        <Trash2 className="size-3.5" />
      </Button>
    </li>
  );
}

function ActivityFormDialog({
  open, onOpenChange, companyId, customerId,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  companyId: string | null | undefined; customerId: string;
}) {
  const queryClient = useQueryClient();
  const [f, setF] = useState({
    activity_type: "task" as "call" | "email" | "meeting" | "note" | "task",
    subject: "", description: "", due_date: "", due_time: "",
  });
  const [errs, setErrs] = useState<Record<string, string>>({});

  const create = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No active company");
      const parsed = activitySchema.safeParse(f);
      if (!parsed.success) {
        const map: Record<string, string> = {};
        for (const i of parsed.error.issues) map[i.path[0] as string] = i.message;
        setErrs(map);
        throw new Error(parsed.error.issues[0]?.message ?? "Data tidak valid");
      }
      setErrs({});
      const v = parsed.data;
      const { data: user } = await supabase.auth.getUser();
      let due_at: string | null = null;
      if (v.due_date) {
        due_at = new Date(`${v.due_date}T${v.due_time || "09:00"}`).toISOString();
      }
      const { error } = await supabase.from("crm_activities").insert({
        company_id: companyId,
        customer_id: customerId,
        activity_type: v.activity_type,
        subject: v.subject,
        description: v.description?.trim() || null,
        due_at,
        assigned_to: user.user?.id ?? null,
        created_by: user.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aktivitas dibuat");
      queryClient.invalidateQueries({ queryKey: ["customer-activities", customerId] });
      setF({ activity_type: "task", subject: "", description: "", due_date: "", due_time: "" });
      setErrs({});
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal membuat aktivitas"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setErrs({}); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Aktivitas baru</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipe</Label>
              <Select value={f.activity_type} onValueChange={(v) => setF({ ...f, activity_type: v as typeof f.activity_type })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Task</SelectItem>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Subject *</Label>
              <Input value={f.subject} maxLength={200} aria-invalid={!!errs.subject}
                onChange={(e) => setF({ ...f, subject: e.target.value })} placeholder="Follow up penawaran" />
              <FieldError msg={errs.subject} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tanggal</Label>
              <Input type="date" value={f.due_date} aria-invalid={!!errs.due_date}
                onChange={(e) => setF({ ...f, due_date: e.target.value })} />
              <FieldError msg={errs.due_date} />
            </div>
            <div>
              <Label>Jam</Label>
              <Input type="time" value={f.due_time} aria-invalid={!!errs.due_time}
                onChange={(e) => setF({ ...f, due_time: e.target.value })} />
              <FieldError msg={errs.due_time} />
            </div>
          </div>
          <div>
            <Label>Catatan</Label>
            <Textarea rows={3} maxLength={1000} aria-invalid={!!errs.description}
              value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
            <FieldError msg={errs.description} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            {create.isPending ? "Menyimpan…" : "Simpan aktivitas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SummaryTile({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub?: string }) {
  return (
    <div className="border border-border rounded-lg p-4 bg-background">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        <Icon className="size-4" />
        <span className="text-[10px] font-mono uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-xl font-extrabold tracking-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

function Panel({ title, count, extra, children }: { title: string; count: number; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-lg bg-background">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{title}</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-surface border border-border">{count}</span>
        </div>
        {extra}
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  );
}

function EmptyRow({ msg }: { msg: string }) {
  return <div className="py-6 text-center text-xs text-muted-foreground">{msg}</div>;
}

function CustomerFormDialog({
  open, onOpenChange, companyId, initial,
}: {
  open: boolean; onOpenChange: (v: boolean) => void;
  companyId: string | null | undefined; initial: CustomerRow | null;
}) {
  const queryClient = useQueryClient();
  const isEdit = !!initial;
  const [f, setF] = useState({
    code: initial?.code ?? "",
    name: initial?.name ?? "",
    tax_id: initial?.tax_id ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    address: initial?.address ?? "",
    payment_terms_days: String(initial?.payment_terms_days ?? 30),
    credit_limit: String(initial?.credit_limit ?? 0),
    currency: initial?.currency ?? "IDR",
    notes: initial?.notes ?? "",
    is_active: initial?.is_active ?? true,
  });
  const [errs, setErrs] = useState<Record<string, string>>({});

  const save = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No active company");
      const parsed = customerSchema.safeParse({
        ...f,
        code: f.code.trim().toUpperCase(),
        currency: f.currency.trim().toUpperCase(),
      });
      if (!parsed.success) {
        const map: Record<string, string> = {};
        for (const i of parsed.error.issues) map[i.path[0] as string] = i.message;
        setErrs(map);
        throw new Error(parsed.error.issues[0]?.message ?? "Data tidak valid");
      }
      setErrs({});
      const v = parsed.data;
      const payload = {
        code: v.code,
        name: v.name,
        tax_id: v.tax_id?.trim() || null,
        email: v.email?.trim() || null,
        phone: v.phone?.trim() || null,
        address: v.address?.trim() || null,
        payment_terms_days: v.payment_terms_days,
        credit_limit: v.credit_limit,
        currency: v.currency,
        notes: v.notes?.trim() || null,
        is_active: v.is_active,
      };
      if (isEdit && initial) {
        const { error } = await supabase.from("customers").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { data: user } = await supabase.auth.getUser();
        const { error } = await supabase.from("customers").insert({
          ...payload,
          company_id: companyId,
          created_by: user.user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(isEdit ? "Customer diperbarui" : "Customer berhasil dibuat");
      queryClient.invalidateQueries({ queryKey: ["crm-customers"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      if (initial) queryClient.invalidateQueries({ queryKey: ["customer", initial.id] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal menyimpan customer"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setErrs({}); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{isEdit ? "Edit customer" : "Customer baru"}</DialogTitle></DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Kode *</Label>
            <Input value={f.code} maxLength={50} aria-invalid={!!errs.code}
              onChange={(e) => setF({ ...f, code: e.target.value })} placeholder="CUST-001" />
            <FieldError msg={errs.code} />
          </div>
          <div>
            <Label>NPWP</Label>
            <Input value={f.tax_id} maxLength={30} aria-invalid={!!errs.tax_id}
              onChange={(e) => setF({ ...f, tax_id: e.target.value })} />
            <FieldError msg={errs.tax_id} />
          </div>
          <div className="col-span-2">
            <Label>Nama *</Label>
            <Input value={f.name} maxLength={200} aria-invalid={!!errs.name}
              onChange={(e) => setF({ ...f, name: e.target.value })} />
            <FieldError msg={errs.name} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={f.email} maxLength={255} aria-invalid={!!errs.email}
              onChange={(e) => setF({ ...f, email: e.target.value })} />
            <FieldError msg={errs.email} />
          </div>
          <div>
            <Label>Telepon</Label>
            <Input value={f.phone} maxLength={30} aria-invalid={!!errs.phone}
              onChange={(e) => setF({ ...f, phone: e.target.value })} />
            <FieldError msg={errs.phone} />
          </div>
          <div className="col-span-2">
            <Label>Alamat</Label>
            <Textarea rows={2} maxLength={500} aria-invalid={!!errs.address}
              value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
            <FieldError msg={errs.address} />
          </div>
          <div>
            <Label>Termin (hari)</Label>
            <Input type="number" min="0" max="365" step="1" aria-invalid={!!errs.payment_terms_days}
              value={f.payment_terms_days} onChange={(e) => setF({ ...f, payment_terms_days: e.target.value })} />
            <FieldError msg={errs.payment_terms_days} />
          </div>
          <div>
            <Label>Limit kredit</Label>
            <Input type="number" min="0" step="0.01" aria-invalid={!!errs.credit_limit}
              value={f.credit_limit} onChange={(e) => setF({ ...f, credit_limit: e.target.value })} />
            <FieldError msg={errs.credit_limit} />
          </div>
          <div>
            <Label>Mata uang</Label>
            <Input value={f.currency} maxLength={3} aria-invalid={!!errs.currency}
              onChange={(e) => setF({ ...f, currency: e.target.value.toUpperCase() })} />
            <FieldError msg={errs.currency} />
          </div>
          <div className="col-span-2 flex items-center gap-2">
            <Switch checked={f.is_active} onCheckedChange={(v) => setF({ ...f, is_active: v })} />
            <Label>Aktif</Label>
          </div>
          <div className="col-span-2">
            <Label>Catatan</Label>
            <Textarea rows={2} maxLength={1000} aria-invalid={!!errs.notes}
              value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
            <FieldError msg={errs.notes} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Menyimpan…" : (isEdit ? "Simpan perubahan" : "Simpan customer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function DeleteCustomerDialog({
  customer, onOpenChange, onConfirm, pending,
}: {
  customer: CustomerRow | null;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  return (
    <AlertDialog open={!!customer} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus customer?</AlertDialogTitle>
          <AlertDialogDescription>
            Customer <strong>{customer?.name}</strong> ({customer?.code}) akan dihapus permanen.
            Tindakan ini tidak bisa dibatalkan dan akan gagal bila customer masih memiliki transaksi terkait.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={pending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {pending ? "Menghapus…" : "Hapus"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
