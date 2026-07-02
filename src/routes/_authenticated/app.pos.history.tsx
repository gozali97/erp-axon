import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";

export const Route = createFileRoute("/_authenticated/app/pos/history")({
  component: PosHistoryPage,
});

const methodLabel: Record<string, string> = {
  cash: "Tunai", card: "Kartu", transfer: "Transfer", qris: "QRIS", other: "Lain",
};

const fmt = (n: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);

function PosHistoryPage() {
  const { data: companyId } = useActiveCompany();

  const { data: payments, isLoading } = useQuery({
    queryKey: ["pos-history", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pos_payments")
        .select("id, payment_no, method, amount, reference, paid_at, customer_invoices(invoice_no, customer_id, customers(name))")
        .eq("company_id", companyId!)
        .order("paid_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <p className="text-sm text-muted-foreground mb-4">
        Riwayat transaksi POS. Setiap transaksi otomatis membuat Delivery Order (mengurangi stok), Invoice, dan jurnal Kas/Piutang.
      </p>
      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr className="text-left">
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">No. Bayar</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Waktu</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Invoice</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Customer</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Metode</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Memuat…</td></tr>}
            {!isLoading && (payments?.length ?? 0) === 0 && (
              <tr><td colSpan={6} className="px-4 py-16 text-center text-muted-foreground">Belum ada transaksi POS.</td></tr>
            )}
            {(payments ?? []).map((p) => {
              const inv = p.customer_invoices as { invoice_no: string; customers: { name: string } | null } | null;
              return (
                <tr key={p.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-mono text-xs">{p.payment_no}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(p.paid_at).toLocaleString("id-ID")}</td>
                  <td className="px-4 py-3 font-mono text-xs">{inv?.invoice_no ?? "-"}</td>
                  <td className="px-4 py-3">{inv?.customers?.name ?? "-"}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 text-[10px] font-mono uppercase border border-border rounded bg-surface">
                      {methodLabel[p.method] ?? p.method}
                    </span>
                    {p.reference && <span className="ml-2 text-xs text-muted-foreground">{p.reference}</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-bold">Rp {fmt(Number(p.amount))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
