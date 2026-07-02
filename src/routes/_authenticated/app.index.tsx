import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Building2, MapPin, Warehouse, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app/")({
  component: DashboardPage,
});

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: typeof Building2;
  hint?: string;
}) {
  return (
    <div className="border border-border bg-background p-6 rounded-lg">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
            {label}
          </div>
          <div className="text-3xl font-extrabold tracking-tight">{value}</div>
          {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
        </div>
        <div className="size-9 rounded bg-primary/10 text-primary flex items-center justify-center">
          <Icon className="size-4" />
        </div>
      </div>
    </div>
  );
}

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: async () => {
      const [profile, companies, branches, warehouses, roles] = await Promise.all([
        supabase.from("profiles").select("display_name, active_company_id").maybeSingle(),
        supabase.from("companies").select("id", { count: "exact", head: true }),
        supabase.from("branches").select("id", { count: "exact", head: true }),
        supabase.from("warehouses").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("id", { count: "exact", head: true }),
      ]);
      return {
        profile: profile.data,
        companyCount: companies.count ?? 0,
        branchCount: branches.count ?? 0,
        warehouseCount: warehouses.count ?? 0,
        roleCount: roles.count ?? 0,
      };
    },
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-2 font-bold">
          Dashboard
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Selamat datang{data?.profile?.display_name ? `, ${data.profile.display_name}` : ""}.
        </h1>
        <p className="text-muted-foreground mt-2">
          Fondasi ERP siap. Berikutnya: modul Products, Inventory, dan Stock Movements.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Companies"
          value={isLoading ? "—" : data!.companyCount}
          icon={Building2}
          hint="Perusahaan yang Anda ikuti"
        />
        <StatCard
          label="Branches"
          value={isLoading ? "—" : data!.branchCount}
          icon={MapPin}
          hint="Cabang aktif"
        />
        <StatCard
          label="Warehouses"
          value={isLoading ? "—" : data!.warehouseCount}
          icon={Warehouse}
          hint="Gudang terdaftar"
        />
        <StatCard
          label="Team Members"
          value={isLoading ? "—" : data!.roleCount}
          icon={Users}
          hint="Total assignment peran"
        />
      </div>

      <div className="border border-border bg-surface-2 rounded-lg p-6">
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
          [ROADMAP]
        </div>
        <h2 className="text-lg font-bold mb-4">Modul berikutnya</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="border-l-2 border-primary pl-4">
            <div className="font-mono text-[10px] text-primary mb-1">FASE 2 — NEXT</div>
            <div className="font-bold mb-1">Master Data & Inventory</div>
            <div className="text-xs text-muted-foreground">
              Products, Categories, Units, Stock Movements, FIFO/LIFO/Average.
            </div>
          </div>
          <div className="border-l-2 border-border pl-4">
            <div className="font-mono text-[10px] text-muted-foreground mb-1">FASE 3</div>
            <div className="font-bold mb-1">Procure-to-Pay</div>
            <div className="text-xs text-muted-foreground">
              Suppliers, PR → PO → GR → Vendor Bill.
            </div>
          </div>
          <div className="border-l-2 border-border pl-4">
            <div className="font-mono text-[10px] text-muted-foreground mb-1">FASE 4</div>
            <div className="font-bold mb-1">Order-to-Cash</div>
            <div className="text-xs text-muted-foreground">
              Customers, Quote → SO → DO → Invoice → Payment.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
