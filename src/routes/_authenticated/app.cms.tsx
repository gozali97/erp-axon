import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/cms")({
  component: CMSLayout,
});

const tabs = [
  { to: "/app/cms", label: "Landing Page", exact: true },
  { to: "/app/cms/posts", label: "Blog Posts", exact: false },
];

function CMSLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Content Management</h1>
        <p className="text-sm text-muted-foreground mt-1">Kelola konten landing page dan blog publik.</p>
      </div>
      <div className="border-b border-border mb-6 flex gap-1">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          return (
            <Link
              key={t.to}
              to={t.to}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
