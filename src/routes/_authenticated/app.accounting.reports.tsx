import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";

export const Route = createFileRoute("/_authenticated/app/accounting/reports")({
  component: ReportsPage,
});

const fmt = (n: number) => new Intl.NumberFormat("id-ID", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);

type Row = {
  account_id: string; code: string; name: string;
  account_type: "asset" | "liability" | "equity" | "revenue" | "expense";
  normal_balance: "debit" | "credit";
  total_debit: number; total_credit: number; balance: number;
};

function ReportsPage() {
  const { data: companyId } = useActiveCompany();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["trial-balance", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trial_balance" as never)
        .select("*")
        .eq("company_id", companyId!)
        .order("code");
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  const { totalDebit, totalCredit, pnl, bs } = useMemo(() => {
    let td = 0, tc = 0;
    let revenue = 0, expense = 0;
    let asset = 0, liability = 0, equity = 0;
    (rows ?? []).forEach((r) => {
      td += Number(r.total_debit);
      tc += Number(r.total_credit);
      const bal = Number(r.balance); // debit - credit
      if (r.account_type === "revenue") revenue += -bal; // credit-normal → -bal is positive
      else if (r.account_type === "expense") expense += bal;
      else if (r.account_type === "asset") asset += bal;
      else if (r.account_type === "liability") liability += -bal;
      else if (r.account_type === "equity") equity += -bal;
    });
    return {
      totalDebit: td, totalCredit: tc,
      pnl: { revenue, expense, net: revenue - expense },
      bs: { asset, liability, equity, net: liability + equity },
    };
  }, [rows]);

  if (isLoading) return <div className="p-8 text-muted-foreground">Memuat…</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard label="Total Aset" value={bs.asset} tone="neutral" />
        <SummaryCard label="Laba/Rugi Bersih" value={pnl.net} tone={pnl.net >= 0 ? "positive" : "negative"} />
        <SummaryCard label="Ekuitas + Kewajiban" value={bs.net} tone="neutral" />
      </div>

      {/* Trial Balance */}
      <section>
        <h2 className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold mb-3">Trial Balance</h2>
        <div className="border border-border rounded-lg overflow-hidden bg-background">
          <table className="w-full text-sm">
            <thead className="bg-surface border-b border-border">
              <tr className="text-left">
                <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Kode</th>
                <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Akun</th>
                <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Debit</th>
                <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Kredit</th>
                <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((r) => {
                const displayBal = r.normal_balance === "debit" ? r.balance : -r.balance;
                return (
                  <tr key={r.account_id} className="border-b border-border last:border-0 hover:bg-surface/50">
                    <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{Number(r.total_debit) > 0 ? fmt(Number(r.total_debit)) : "—"}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{Number(r.total_credit) > 0 ? fmt(Number(r.total_credit)) : "—"}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs font-semibold">{displayBal !== 0 ? fmt(displayBal) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-surface border-t-2 border-border">
              <tr>
                <td colSpan={2} className="px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground">Total</td>
                <td className="px-4 py-2 text-right font-mono text-xs font-bold">{fmt(totalDebit)}</td>
                <td className="px-4 py-2 text-right font-mono text-xs font-bold">{fmt(totalCredit)}</td>
                <td className="px-4 py-2 text-right font-mono text-[10px]">
                  {totalDebit === totalCredit ? <span className="text-green-700">✓ Balanced</span> : <span className="text-destructive">Selisih</span>}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {/* P&L + Balance Sheet */}
      <div className="grid grid-cols-2 gap-6">
        <section>
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold mb-3">Profit & Loss</h2>
          <div className="border border-border rounded-lg bg-background divide-y divide-border">
            <div className="flex justify-between px-4 py-3"><span>Pendapatan</span><span className="font-mono">{fmt(pnl.revenue)}</span></div>
            <div className="flex justify-between px-4 py-3"><span>Beban</span><span className="font-mono">({fmt(pnl.expense)})</span></div>
            <div className="flex justify-between px-4 py-3 bg-surface font-semibold">
              <span>Laba Bersih</span>
              <span className={`font-mono ${pnl.net >= 0 ? "text-green-700" : "text-destructive"}`}>{fmt(pnl.net)}</span>
            </div>
          </div>
        </section>

        <section>
          <h2 className="font-mono text-[11px] uppercase tracking-widest text-primary font-bold mb-3">Balance Sheet</h2>
          <div className="border border-border rounded-lg bg-background divide-y divide-border">
            <div className="flex justify-between px-4 py-3"><span>Total Aset</span><span className="font-mono">{fmt(bs.asset)}</span></div>
            <div className="flex justify-between px-4 py-3"><span>Kewajiban</span><span className="font-mono">{fmt(bs.liability)}</span></div>
            <div className="flex justify-between px-4 py-3"><span>Ekuitas</span><span className="font-mono">{fmt(bs.equity)}</span></div>
            <div className="flex justify-between px-4 py-3 bg-surface font-semibold">
              <span>Kewajiban + Ekuitas</span>
              <span className="font-mono">{fmt(bs.net)}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone: "positive" | "negative" | "neutral" }) {
  const color = tone === "positive" ? "text-green-700" : tone === "negative" ? "text-destructive" : "text-foreground";
  return (
    <div className="border border-border rounded-lg p-4 bg-background">
      <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{label}</div>
      <div className={`text-2xl font-extrabold font-mono tracking-tight ${color}`}>{fmt(value)}</div>
    </div>
  );
}
