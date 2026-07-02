import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/pos")({
  component: PosLayout,
});

const tabs = [
  { to: "/app/pos", label: "Kasir" },
  { to: "/app/pos/history", label: "Riwayat" },
];

function PosLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div>
      <div className="border-b border-border bg-surface/40">
        <div className="max-w-7xl mx-auto px-8 pt-6">
          <div className="font-mono text-[11px] uppercase tracking-widest text-primary mb-2 font-bold">
            Operations / Point of Sale
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-4">POS</h1>
          <nav className="flex gap-1 -mb-px">
            {tabs.map((t) => {
              const active = t.to === "/app/pos"
                ? pathname === t.to
                : pathname.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
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
