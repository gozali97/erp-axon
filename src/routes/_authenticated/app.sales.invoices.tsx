import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveCompany } from "@/hooks/use-active-company";

export const Route = createFileRoute("/_authenticated/app/sales/invoices")({
  component: InvoicesPage,
});

const statusColor: Record<string, string> = {
  draft: "text-muted-foreground bg-surface border-border",
  issued: "text-blue-700 bg-blue-50 border-blue-200",
  partial: "text-amber-700 bg-amber-50 border-amber-200",
  paid: "text-green-700 bg-green-50 border-green-200",
  void: "text-red-700 bg-red-50 border-red-200",
};

function InvoicesPage() {
  const { data: companyId } = useActiveCompany();
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_invoices")
        .select("id, invoice_no, invoice_date, due_date, status, grand_total, amount_paid, currency, sales_order_id, customers(name), sales_orders(so_no)")
        .eq("company_id", companyId!)
        .order("invoice_date", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <p className="text-sm text-muted-foreground mb-6">Invoice pelanggan (dibuat dari Sales Order).</p>

      <div className="border border-border rounded-lg overflow-hidden bg-background">
        <table className="w-full text-sm">
          <thead className="bg-surface border-b border-border">
            <tr className="text-left">
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">No. Invoice</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Tanggal</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Jatuh tempo</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Customer</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">SO</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Status</th>
              <th className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Memuat…</td></tr>}
            {!isLoading && (invoices?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center">
                  <FileText className="mx-auto size-8 text-muted-foreground mb-3" />
                  <div className="font-medium mb-1">Belum ada invoice</div>
                  <div className="text-xs text-muted-foreground">Buat invoice dari halaman detail Sales Order.</div>
                </td>
              </tr>
            )}
            {invoices?.map((inv) => (
              <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-surface/50">
                <td className="px-4 py-3 font-mono text-xs font-medium">{inv.invoice_no}</td>
                <td className="px-4 py-3 text-xs">{inv.invoice_date}</td>
                <td className="px-4 py-3 text-xs">{inv.due_date || "—"}</td>
                <td className="px-4 py-3">{(inv.customers as { name: string } | null)?.name}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {inv.sales_order_id ? (
                    <Link to="/app/sales/orders/$soId" params={{ soId: inv.sales_order_id }} className="text-primary hover:underline">
                      {(inv.sales_orders as { so_no: string } | null)?.so_no}
                    </Link>
                  ) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-mono uppercase px-2 py-0.5 border ${statusColor[inv.status] || ""}`}>{inv.status}</span>
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {Number(inv.grand_total).toLocaleString("id-ID", { maximumFractionDigits: 0 })}
                  <span className="text-[10px] text-muted-foreground ml-1">{inv.currency}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
