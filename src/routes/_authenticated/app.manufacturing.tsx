import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/manufacturing")({
  component: MfgLayout,
});

const tabs = [
  { to: "/app/manufacturing/bom", label: "Bill of Materials" },
  { to: "/app/manufacturing/mrp", label: "Material Requirements" },
  { to: "/app/manufacturing/wo", label: "Work Orders" },
];

function MfgLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div>
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-8 pt-8">
          <div className="mb-6">
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Module 08</div>
            <h1 className="text-2xl font-extrabold tracking-tight">Manufacturing</h1>
          </div>
          <nav className="flex gap-6 -mb-px">
            {tabs.map((t) => {
              const active = pathname.startsWith(t.to);
              return (
                <Link key={t.to} to={t.to} className={`pb-3 text-sm font-medium border-b-2 transition-colors ${active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                  {t.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <Outlet />
    </div>
  );
}
