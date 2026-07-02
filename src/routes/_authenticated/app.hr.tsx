import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/hr")({
  component: HRLayout,
});

const tabs = [
  { to: "/app/hr/employees", label: "Employees" },
  { to: "/app/hr/departments", label: "Departments" },
  { to: "/app/hr/attendance", label: "Attendance" },
  { to: "/app/hr/leave", label: "Leave" },
  { to: "/app/hr/payroll", label: "Payroll" },
];

function HRLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div>
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-8 pt-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Module 07</div>
              <h1 className="text-2xl font-extrabold tracking-tight">Human Resources</h1>
            </div>
          </div>
          <nav className="flex gap-6 -mb-px">
            {tabs.map((t) => {
              const active = pathname.startsWith(t.to);
              return (
                <Link
                  key={t.to}
                  to={t.to}
                  className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                    active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
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
