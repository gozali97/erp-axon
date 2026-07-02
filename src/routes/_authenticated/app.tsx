import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  Receipt,
  ScanLine,
  Users,
  Factory,
  BarChart3,
  BookOpen,
  FileText,
  Settings,
  LogOut,
  Building2,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app")({
  component: AppLayout,
});

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  enabled: boolean;
};

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/app", icon: LayoutDashboard, enabled: true }],
  },
  {
    label: "Master Data",
    items: [
      { title: "Products", url: "/app/products", icon: Package, enabled: true },
      { title: "Categories", url: "/app/categories", icon: Boxes, enabled: true },
      { title: "Units", url: "/app/units", icon: Package, enabled: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Inventory", url: "/app/inventory", icon: Boxes, enabled: true },
      { title: "Purchasing", url: "/app/purchasing", icon: ShoppingCart, enabled: true },
      { title: "Sales", url: "/app/sales", icon: Receipt, enabled: true },
      { title: "POS", url: "/app/pos", icon: ScanLine, enabled: true },
      { title: "Manufacturing", url: "/app/manufacturing", icon: Factory, enabled: true },
      { title: "CRM", url: "/app/crm", icon: Users, enabled: true },
    ],
  },
  {
    label: "Human Resources",
    items: [
      { title: "Employees", url: "/app/hr/employees", icon: Users, enabled: true },
      { title: "Departments", url: "/app/hr/departments", icon: Building2, enabled: true },
      { title: "Attendance", url: "/app/hr/attendance", icon: LayoutDashboard, enabled: true },
      { title: "Leave", url: "/app/hr/leave", icon: FileText, enabled: true },
      { title: "Payroll", url: "/app/hr/payroll", icon: Receipt, enabled: true },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Accounting", url: "/app/accounting", icon: BookOpen, enabled: true },
    ],
  },
  {
    label: "Content",
    items: [{ title: "CMS", url: "/app/cms", icon: FileText, enabled: true }],
  },
  {
    label: "Insights",
    items: [{ title: "Reports", url: "/app/reports", icon: BarChart3, enabled: false }],
  },
  {
    label: "Settings",
    items: [
      { title: "Company", url: "/app/settings/company", icon: Building2, enabled: false },
      { title: "Settings", url: "/app/settings", icon: Settings, enabled: false },
    ],
  },
];

function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="px-4 py-4 border-b border-border">
          <Link to="/" className="font-extrabold tracking-tighter text-lg">
            {collapsed ? "A." : "AXON."}
          </Link>
        </div>
        {navSections.map((section) => (
          <SidebarGroup key={section.label}>
            {!collapsed && <SidebarGroupLabel>{section.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const active = pathname === item.url;
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild={item.enabled}
                        isActive={active}
                        disabled={!item.enabled}
                        tooltip={!item.enabled ? `${item.title} (coming soon)` : item.title}
                        className={!item.enabled ? "opacity-50 cursor-not-allowed" : ""}
                      >
                        {item.enabled ? (
                          <Link to={item.url} className="flex items-center gap-2">
                            <item.icon className="size-4" />
                            {!collapsed && <span>{item.title}</span>}
                          </Link>
                        ) : (
                          <div className="flex items-center gap-2">
                            <item.icon className="size-4" />
                            {!collapsed && (
                              <span className="flex-1 flex items-center justify-between">
                                {item.title}
                                <span className="text-[9px] font-mono uppercase text-muted-foreground">
                                  soon
                                </span>
                              </span>
                            )}
                          </div>
                        )}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

function CompanySwitcher() {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["profile-companies"],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, active_company_id, display_name, email")
        .maybeSingle();

      const { data: roles } = await supabase
        .from("user_roles")
        .select("company_id, role, companies!inner(id, name)");

      return {
        profile,
        companies: (roles ?? []).map((r) => ({
          id: (r.companies as { id: string; name: string }).id,
          name: (r.companies as { id: string; name: string }).name,
          role: r.role,
        })),
      };
    },
  });

  const activeCompany = data?.companies.find((c) => c.id === data?.profile?.active_company_id) ?? data?.companies[0];

  async function switchCompany(companyId: string) {
    await supabase.from("profiles").update({ active_company_id: companyId }).eq("id", data!.profile!.id);
    queryClient.invalidateQueries();
    toast.success("Perusahaan aktif diganti");
  }

  if (!activeCompany) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium border border-border rounded hover:bg-surface transition-colors">
        <Building2 className="size-4" />
        <span className="max-w-[200px] truncate">{activeCompany.name}</span>
        <span className="text-[10px] font-mono uppercase text-muted-foreground">{activeCompany.role}</span>
        <ChevronDown className="size-3" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-xs">Ganti perusahaan</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {data!.companies.map((c) => (
          <DropdownMenuItem key={c.id} onClick={() => switchCompany(c.id)}>
            <div className="flex-1">
              <div className="font-medium">{c.name}</div>
              <div className="text-[10px] font-mono uppercase text-muted-foreground">{c.role}</div>
            </div>
            {c.id === activeCompany.id && <span className="text-primary text-xs">•</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["current-profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("display_name, email, avatar_url").maybeSingle();
      return data;
    },
  });

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const initial = (data?.display_name || data?.email || "?").charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="size-9 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center hover:bg-primary/20 transition-colors">
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="font-medium">{data?.display_name || "User"}</div>
          <div className="text-xs text-muted-foreground truncate">{data?.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
          <LogOut className="size-4 mr-2" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppLayout() {
  // Register auth state listener at layout scope
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        window.location.href = "/auth";
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-background/80 backdrop-blur sticky top-0 z-30">
            <div className="flex items-center gap-3">
              <SidebarTrigger />
              <span className="font-mono text-[10px] text-green-700 bg-green-50 px-2 py-0.5 border border-green-200 hidden sm:inline">
                v4.2.0 STABLE
              </span>
            </div>
            <div className="flex items-center gap-3">
              <CompanySwitcher />
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
