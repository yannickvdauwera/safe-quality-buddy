import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  FileText,
  AlertTriangle,
  ClipboardCheck,
  ClipboardList,
  ShieldAlert,
  Users,
  Wrench,
  LogOut,
  Menu,
  X,
  ShieldCheck,
  Shield,
  Eye,
  Hand,
  ChevronDown,
  ChevronRight,
  FileEdit,
  GraduationCap,
  
  
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";

type IconType = typeof LayoutDashboard;

interface NavLeaf {
  kind?: "leaf";
  to: string;
  label: string;
  icon: IconType;
  disabled?: boolean;
}
interface NavGroup {
  kind: "group";
  basePath: string; // used to determine "active" and expanded state
  label: string;
  icon: IconType;
  children: NavLeaf[];
}
type NavItem = NavLeaf | NavGroup;

const baseNav: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/employees", label: "Medewerkers", icon: Users },
  {
    kind: "group",
    basePath: "/meldingen-hub",
    label: "Meldingen",
    icon: AlertTriangle,
    children: [
      { to: "/mos", label: "MOS-meldingen", icon: Eye },
      { to: "/stop", label: "STOP-reflexen", icon: Hand },
      { to: "/meldingen/intern", label: "Interne meldingen", icon: AlertTriangle },
      { to: "/meldingen/ongevallen", label: "(Bijna)ongevallen", icon: ShieldAlert },
    ],
  },
  {
    kind: "group",
    basePath: "/inspecties",
    label: "Inspecties",
    icon: ClipboardCheck,
    children: [
      { to: "/inspecties/wpi", label: "Werkplekinspecties", icon: ClipboardCheck },
      { to: "/inspecties/kwaliteit", label: "Kwaliteitscontroles", icon: ClipboardList },
    ],
  },
  { to: "/drafts", label: "Mijn concepten", icon: FileEdit },
  { to: "/documents", label: "Documenten", icon: FileText, disabled: true },
  { to: "/toolboxes", label: "Toolboxen", icon: ClipboardCheck },
  { to: "/leren", label: "Leren & Klassement", icon: GraduationCap },
  { to: "/risk-analyses", label: "Risicoanalyses", icon: ShieldAlert },
];


export function AppShell({ children }: { children: ReactNode }) {
  const { user, roles, hasRole, realRoles, previewRole, isPreviewing, setPreviewRole } = useAuth();
  const isRealAdmin = realRoles.includes("admin");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const nav: NavItem[] = hasRole("admin")
    ? [
        ...baseNav,
        {
          kind: "group",
          basePath: "/instellingen-hub",
          label: "Instellingen",
          icon: Wrench,
          children: [
            { to: "/users", label: "Gebruikers & rollen", icon: Shield },
          ],
        },
      ]
    : baseNav;

  const handleSignOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const initials =
    user?.user_metadata?.full_name?.split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase() ??
    user?.email?.slice(0, 2).toUpperCase() ??
    "??";

  const roleLabel =
    roles.includes("admin") ? "Admin"
    : roles.includes("hse_manager") ? "HSE-manager"
    : roles.includes("manager") ? "Manager"
    : "Operator";

  const renderLeaf = (item: NavLeaf, indent = false) => {
    const active = pathname === item.to || pathname.startsWith(item.to + "/");
    const Icon = item.icon;
    if (item.disabled) {
      return (
        <div
          key={item.to}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground/60 cursor-not-allowed",
            indent && "ml-6",
          )}
          title="Binnenkort beschikbaar"
        >
          <Icon className="w-4 h-4" />
          <span>{item.label}</span>
          <span className="ml-auto text-[10px] uppercase tracking-wide">Soon</span>
        </div>
      );
    }
    return (
      <Link
        key={item.to}
        to={item.to}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
          indent && "ml-6",
          active
            ? "bg-primary text-primary-foreground font-medium"
            : "text-foreground hover:bg-muted",
        )}
      >
        <Icon className="w-4 h-4" />
        <span>{item.label}</span>
      </Link>
    );
  };

  const SidebarContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-sm leading-tight">HSE & Kwaliteit</div>
          <div className="text-xs text-muted-foreground truncate">Beheerplatform</div>
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {nav.map((item) => {
          if ("kind" in item && item.kind === "group") {
            const groupActive =
              pathname.startsWith(item.basePath) ||
              item.children.some((c) => pathname === c.to || pathname.startsWith(c.to + "/"));
            const expanded = openGroups[item.basePath] ?? groupActive;
            const Icon = item.icon;
            const Chevron = expanded ? ChevronDown : ChevronRight;
            return (
              <div key={item.basePath}>
                <button
                  type="button"
                  onClick={() => setOpenGroups((s) => ({ ...s, [item.basePath]: !expanded }))}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    groupActive ? "text-foreground font-medium" : "text-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                  <Chevron className="w-4 h-4 ml-auto text-muted-foreground" />
                </button>
                {expanded && (
                  <div className="mt-0.5 space-y-0.5">
                    {item.children.map((c) => renderLeaf(c, true))}
                  </div>
                )}
              </div>
            );
          }
          return renderLeaf(item as NavLeaf);
        })}
      </nav>

      <div className="p-3 border-t space-y-2">
        {isRealAdmin && (
          <div className="px-1">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Bekijk als rol</div>
            <Select
              value={previewRole ?? "__real"}
              onValueChange={(v) => setPreviewRole(v === "__real" ? null : (v as any))}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__real">Mijn eigen rol (Admin)</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="hse_manager">HSE-manager</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="operator">Operator</SelectItem>
              </SelectContent>
            </Select>
            {isPreviewing && (
              <div className="text-[10px] text-amber-600 mt-1">
                Preview-modus — data-toegang blijft admin
              </div>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{user?.user_metadata?.full_name ?? user?.email}</div>
            <div className="text-xs text-muted-foreground">{roleLabel}{isPreviewing && " (preview)"}</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="w-full justify-start" onClick={handleSignOut}>
          <LogOut className="w-4 h-4" /> Afmelden
        </Button>
      </div>

    </div>
  );

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 border-r bg-card z-30">
        {SidebarContent}
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-20 bg-card border-b flex items-center gap-3 px-4 py-3">
        <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)}>
          <Menu className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <span className="font-semibold text-sm">HSE & Kwaliteit</span>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-card border-r flex flex-col">
            <button className="absolute top-3 right-3 p-1" onClick={() => setMobileOpen(false)}>
              <X className="w-5 h-5" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      <main className="lg:pl-64">
        <div className="max-w-7xl mx-auto p-4 md:p-8">{children}</div>
      </main>
    </div>
  );
}
