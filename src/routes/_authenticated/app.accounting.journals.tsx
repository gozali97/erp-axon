import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/accounting/journals")({
  component: JournalsPage,
});

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

function JournalsPage() {
  const { data: companyId } = useActiveCompany();
  const [open, setOpen] = useState(false);

  const { data: entries, isLoading } = useQuery({
    queryKey: ["journal-entries", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries").select("*")
        .eq("company_id", companyId!).order("entry_date", { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <p className="text-sm text-muted-foreground">Jurnal umum. Setiap posting divalidasi debit = kredit.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="size-4" /> Jurnal baru</Button>
          </DialogTrigger>
          <CreateJournalDialog companyId={companyId} onDone={() => setOpen(false)} />
        </Dialog>
      </div>

      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr className="text-left">
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">No</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Tanggal</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Memo</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Sumber</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Debit</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Kredit</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Memuat…</td></tr>}
            {!isLoading && (entries?.length ?? 0) === 0 && (
              <tr><td colSpan={7} className="px-4 py-16 text-center">
                <BookOpen className="mx-auto size-8 text-muted-foreground mb-3" />
                <div className="font-medium mb-1">Belum ada jurnal</div>
                <Button size="sm" onClick={() => setOpen(true)} className="mt-2 gap-2"><Plus className="size-4" /> Buat jurnal</Button>
              </td></tr>
            )}
            {entries?.map((e) => (
              <tr key={e.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                <td className="px-4 py-3 font-mono text-xs">{e.entry_no}</td>
                <td className="px-4 py-3 font-mono text-xs">{e.entry_date}</td>
                <td className="px-4 py-3">{e.memo || <span className="text-muted-foreground">—</span>}</td>
                <td className="px-4 py-3 font-mono text-[10px] uppercase text-muted-foreground">{e.source}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">{fmt(Number(e.total_debit))}</td>
                <td className="px-4 py-3 text-right font-mono text-xs">{fmt(Number(e.total_credit))}</td>
                <td className="px-4 py-3">
                  <span className="text-[10px] font-mono uppercase text-green-700 bg-green-50 px-2 py-0.5 border border-green-200">{e.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

type Line = { account_id: string; description: string; debit: string; credit: string };

function CreateJournalDialog({ companyId, onDone }: { companyId: string | null | undefined; onDone: () => void }) {
  const queryClient = useQueryClient();
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [memo, setMemo] = useState("");
  const [lines, setLines] = useState<Line[]>([
    { account_id: "", description: "", debit: "", credit: "" },
    { account_id: "", description: "", debit: "", credit: "" },
  ]);

  const { data: accounts } = useQuery({
    queryKey: ["accounts-postable", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase.from("accounts")
        .select("id, code, name").eq("company_id", companyId!).eq("is_group", false).eq("is_active", true)
        .order("code");
      if (error) throw error;
      return data;
    },
  });

  const totals = useMemo(() => {
    const d = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const c = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
    return { d, c, balanced: d === c && d > 0 };
  }, [lines]);

  const post = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      const clean = lines.filter((l) => l.account_id && ((Number(l.debit) || 0) + (Number(l.credit) || 0)) > 0);
      if (clean.length < 2) throw new Error("Minimal 2 baris terisi");
      if (!totals.balanced) throw new Error("Debit ≠ Kredit");
      const { error } = await supabase.rpc("post_journal_entry", {
        _company_id: companyId,
        _entry_date: entryDate,
        _memo: memo || null,
        _source: "manual",
        _source_ref: null,
        _lines: clean.map((l) => ({
          account_id: l.account_id,
          description: l.description || null,
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        })),
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Jurnal diposting");
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["trial-balance"] });
      onDone();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Gagal"),
  });

  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader><DialogTitle>Jurnal baru</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-4">
        <div><Label>Tanggal</Label><Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} /></div>
        <div><Label>Memo</Label><Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Keterangan" /></div>
      </div>

      <div className="border border-border rounded overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-surface border-b border-border">
            <tr>
              <th className="px-2 py-2 text-left font-mono text-[10px] uppercase text-muted-foreground">Akun</th>
              <th className="px-2 py-2 text-left font-mono text-[10px] uppercase text-muted-foreground">Deskripsi</th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase text-muted-foreground w-32">Debit</th>
              <th className="px-2 py-2 text-right font-mono text-[10px] uppercase text-muted-foreground w-32">Kredit</th>
              <th className="w-8"></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-border last:border-0">
                <td className="p-1">
                  <Select value={l.account_id} onValueChange={(v) => setLines(lines.map((x, j) => j === i ? { ...x, account_id: v } : x))}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih akun" /></SelectTrigger>
                    <SelectContent>
                      {accounts?.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.code} — {a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="p-1"><Input className="h-8 text-xs" value={l.description} onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} /></td>
                <td className="p-1"><Input className="h-8 text-xs text-right font-mono" type="number" step="0.01" value={l.debit}
                  onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, debit: e.target.value, credit: e.target.value ? "" : x.credit } : x))} /></td>
                <td className="p-1"><Input className="h-8 text-xs text-right font-mono" type="number" step="0.01" value={l.credit}
                  onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, credit: e.target.value, debit: e.target.value ? "" : x.debit } : x))} /></td>
                <td className="p-1 text-center">
                  {lines.length > 2 && (
                    <button type="button" onClick={() => setLines(lines.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-surface/50 border-t border-border">
            <tr>
              <td colSpan={2} className="px-2 py-2 text-xs">
                <button type="button" onClick={() => setLines([...lines, { account_id: "", description: "", debit: "", credit: "" }])} className="text-primary hover:underline text-xs">+ Tambah baris</button>
              </td>
              <td className="px-2 py-2 text-right font-mono text-xs">{fmt(totals.d)}</td>
              <td className="px-2 py-2 text-right font-mono text-xs">{fmt(totals.c)}</td>
              <td></td>
            </tr>
            <tr>
              <td colSpan={5} className="px-2 py-2 text-xs text-right">
                {totals.balanced ? (
                  <span className="text-green-700 font-mono uppercase text-[10px]">✓ Balanced</span>
                ) : (
                  <span className="text-destructive font-mono uppercase text-[10px]">Selisih: {fmt(totals.d - totals.c)}</span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onDone}>Batal</Button>
        <Button onClick={() => post.mutate()} disabled={post.isPending || !totals.balanced}>{post.isPending ? "Posting…" : "Post jurnal"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
