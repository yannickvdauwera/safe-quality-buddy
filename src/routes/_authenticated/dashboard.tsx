import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users, AlertTriangle, CheckCircle2, Clock, TrendingUp, ShieldAlert, ArrowRight, Activity,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — HSE & Kwaliteit" }] }),
  component: DashboardPage,
});

const TYPE_LABELS: Record<string, string> = {
  mos: "MOS",
  stop: "STOP",
  ao_ehbo: "AO/EHBO",
  werkplekinspectie: "Werkplekinsp.",
  kwaliteit: "Kwaliteit",
  klacht: "Klacht",
  andere: "Andere",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_behandeling: "In behandeling",
  opgevolgd: "Opgevolgd",
  gesloten: "Gesloten",
};

const SEVERITY_LABELS: Record<string, string> = {
  laag: "Laag", middel: "Middel", hoog: "Hoog", kritiek: "Kritiek",
};

const severityVariant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
  s === "kritiek" ? "destructive" : s === "hoog" ? "default" : s === "middel" ? "secondary" : "outline";

function pickRole(roles: AppRole[]): AppRole {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("hse_manager")) return "hse_manager";
  if (roles.includes("manager")) return "manager";
  return "operator";
}

function DashboardPage() {
  const { user, roles, loading } = useAuth();

  if (loading || !user) {
    return <div className="text-sm text-muted-foreground">Bezig met laden…</div>;
  }

  const primaryRole = pickRole(roles);
  const greeting = user.user_metadata?.full_name?.split(" ")[0] ?? "welkom";
  const roleLabel =
    primaryRole === "admin" ? "Beheerder"
    : primaryRole === "hse_manager" ? "HSE-manager"
    : primaryRole === "manager" ? "Leidinggevende"
    : "Operator";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hallo {greeting}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Aangemeld als <span className="font-medium text-foreground">{roleLabel}</span>
        </p>
      </div>

      {primaryRole === "operator" && <OperatorDashboard userId={user.id} />}
      {primaryRole === "manager" && <ManagerDashboard userId={user.id} />}
      {primaryRole === "hse_manager" && <HseDashboard />}
      {primaryRole === "admin" && <AdminDashboard />}
    </div>
  );
}

/* ---------------- OPERATOR ---------------- */
function OperatorDashboard({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["dashboard-metrics", "operator", userId],
    queryFn: async () => {
      const { data: mine = [] } = await supabase
        .from("reports")
        .select("id, type, title, status, severity, observed_at")
        .eq("reporter_id", userId)
        .order("observed_at", { ascending: false });
      return {
        total: mine?.length ?? 0,
        open: mine?.filter((r) => r.status === "open").length ?? 0,
        inBehandeling: mine?.filter((r) => r.status === "in_behandeling").length ?? 0,
        gesloten: mine?.filter((r) => r.status === "gesloten" || r.status === "opgevolgd").length ?? 0,
        recent: mine?.slice(0, 5) ?? [],
      };
    },
  });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={AlertTriangle} label="Mijn meldingen (totaal)" value={data?.total} accent="text-blue-600" />
        <StatCard icon={Clock} label="Nog open" value={data?.open} accent="text-orange-600" />
        <StatCard icon={Activity} label="In behandeling" value={data?.inBehandeling} accent="text-purple-600" />
        <StatCard icon={CheckCircle2} label="Afgerond" value={data?.gesloten} accent="text-green-600" />
      </div>

      <RecentReportsCard title="Mijn recente meldingen" reports={data?.recent} emptyText="Je hebt nog geen meldingen gemaakt." />

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">Iets vastgesteld op de werf?</div>
            <div className="text-sm text-muted-foreground">Registreer een MOS-, STOP- of andere melding in enkele klikken.</div>
          </div>
          <Button asChild><Link to="/meldingen">Nieuwe melding <ArrowRight className="w-4 h-4" /></Link></Button>
        </CardContent>
      </Card>
    </>
  );
}

/* ---------------- MANAGER ---------------- */
function ManagerDashboard({ userId }: { userId: string }) {
  const { data } = useQuery({
    queryKey: ["dashboard-metrics", "manager", userId],
    queryFn: async () => {
      const { data: all = [] } = await supabase
        .from("reports")
        .select("id, type, title, status, severity, observed_at, reporter_id, assigned_to, deadline");
      const mine = all?.filter((r) => r.assigned_to === userId) ?? [];
      const now = Date.now();
      return {
        assignedOpen: mine.filter((r) => r.status !== "gesloten" && r.status !== "opgevolgd").length,
        overdue: mine.filter((r) => r.deadline && new Date(r.deadline).getTime() < now && r.status !== "gesloten").length,
        needsFollowUp: (all ?? []).filter((r) => r.status === "open" || r.status === "in_behandeling").length,
        highSeverity: (all ?? []).filter((r) => (r.severity === "hoog" || r.severity === "kritiek") && r.status !== "gesloten").length,
        toFollow: mine.filter((r) => r.status !== "gesloten").slice(0, 5),
      };
    },
  });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Clock} label="Toegewezen — open" value={data?.assignedOpen} accent="text-orange-600" />
        <StatCard icon={AlertTriangle} label="Deadline overschreden" value={data?.overdue} accent="text-red-600" />
        <StatCard icon={Activity} label="Vereist opvolging (org.)" value={data?.needsFollowUp} accent="text-blue-600" />
        <StatCard icon={ShieldAlert} label="Hoog / kritiek open" value={data?.highSeverity} accent="text-red-600" />
      </div>

      <RecentReportsCard
        title="Meldingen die jouw opvolging vereisen"
        reports={data?.toFollow}
        emptyText="Geen openstaande meldingen aan jou toegewezen — goed werk."
      />
    </>
  );
}

/* ---------------- HSE MANAGER ---------------- */
function HseDashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-metrics", "hse"],
    queryFn: async () => {
      const { data: all = [] } = await supabase
        .from("reports")
        .select("id, type, title, status, severity, observed_at, reporter_id");
      const { count: empCount } = await supabase.from("employees").select("*", { count: "exact", head: true }).eq("active", true);
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
      const recent = (all ?? []).filter((r) => new Date(r.observed_at) >= thirtyDaysAgo);

      const byType: Record<string, number> = {};
      recent.forEach((r) => { byType[r.type] = (byType[r.type] ?? 0) + 1; });

      const byReporter: Record<string, number> = {};
      recent.forEach((r) => {
        if (r.reporter_id) byReporter[r.reporter_id] = (byReporter[r.reporter_id] ?? 0) + 1;
      });
      const topReporterIds = Object.entries(byReporter).sort((a, b) => b[1] - a[1]).slice(0, 5);

      const profiles = topReporterIds.length
        ? (await supabase.from("profiles").select("id, full_name, email").in("id", topReporterIds.map(([id]) => id))).data ?? []
        : [];

      return {
        total30d: recent.length,
        open: (all ?? []).filter((r) => r.status === "open").length,
        critical: (all ?? []).filter((r) => r.severity === "kritiek" && r.status !== "gesloten").length,
        employees: empCount ?? 0,
        byType,
        topReporters: topReporterIds.map(([id, count]) => ({
          id, count,
          name: profiles.find((p) => p.id === id)?.full_name ?? profiles.find((p) => p.id === id)?.email ?? "Onbekend",
        })),
        recent: (all ?? []).slice(0, 6),
      };
    },
  });

  const typeEntries = Object.entries(data?.byType ?? {}).sort((a, b) => b[1] - a[1]);
  const maxType = Math.max(1, ...typeEntries.map(([, n]) => n));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={TrendingUp} label="Meldingen (30d)" value={data?.total30d} accent="text-blue-600" />
        <StatCard icon={Clock} label="Nog open" value={data?.open} accent="text-orange-600" />
        <StatCard icon={ShieldAlert} label="Kritiek open" value={data?.critical} accent="text-red-600" />
        <StatCard icon={Users} label="Actieve medewerkers" value={data?.employees} accent="text-green-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meldingen per type (30d)</CardTitle>
            <CardDescription>Verdeling van de recent geregistreerde meldingen</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {typeEntries.length === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Nog geen meldingen deze maand.</div>
            ) : typeEntries.map(([type, n]) => (
              <div key={type}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{TYPE_LABELS[type] ?? type}</span>
                  <span className="text-muted-foreground">{n}</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(n / maxType) * 100}%` }} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top melders (30d)</CardTitle>
            <CardDescription>Wie draagt het meest bij aan de meldingscultuur</CardDescription>
          </CardHeader>
          <CardContent>
            {(data?.topReporters?.length ?? 0) === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">Nog geen data.</div>
            ) : (
              <div className="space-y-2">
                {data!.topReporters.map((r, i) => (
                  <div key={r.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/30">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center font-semibold">
                      {i + 1}
                    </div>
                    <div className="flex-1 text-sm font-medium truncate">{r.name}</div>
                    <Badge variant="secondary">{r.count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <RecentReportsCard title="Recente meldingen" reports={data?.recent} emptyText="Nog geen meldingen." />
    </>
  );
}

/* ---------------- ADMIN ---------------- */
function AdminDashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-metrics", "admin"],
    queryFn: async () => {
      const [{ count: reportCount }, { count: employeeCount }, { data: usersByRole }] = await Promise.all([
        supabase.from("reports").select("*", { count: "exact", head: true }),
        supabase.from("employees").select("*", { count: "exact", head: true }).eq("active", true),
        supabase.from("user_roles").select("role"),
      ]);
      const roleCounts: Record<string, number> = {};
      (usersByRole ?? []).forEach((r) => { roleCounts[r.role] = (roleCounts[r.role] ?? 0) + 1; });
      const { data: recent = [] } = await supabase
        .from("reports")
        .select("id, type, title, status, severity, observed_at")
        .order("observed_at", { ascending: false })
        .limit(6);
      return { reportCount, employeeCount, roleCounts, recent };
    },
  });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={AlertTriangle} label="Meldingen (totaal)" value={data?.reportCount} accent="text-blue-600" />
        <StatCard icon={Users} label="Actieve medewerkers" value={data?.employeeCount} accent="text-green-600" />
        <StatCard icon={ShieldAlert} label="Admins" value={data?.roleCounts["admin"] ?? 0} accent="text-red-600" />
        <StatCard icon={Activity} label="Gebruikers m/ rol" value={Object.values(data?.roleCounts ?? {}).reduce((a, b) => a + b, 0)} accent="text-purple-600" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rolverdeling</CardTitle>
          <CardDescription>Aantal gebruikers per rol</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { key: "admin", label: "Admin" },
            { key: "hse_manager", label: "HSE-manager" },
            { key: "manager", label: "Leidinggevende" },
            { key: "operator", label: "Operator" },
          ].map((r) => (
            <div key={r.key} className="p-3 rounded-lg border bg-muted/30">
              <div className="text-xs text-muted-foreground">{r.label}</div>
              <div className="text-2xl font-semibold">{data?.roleCounts[r.key] ?? 0}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      <RecentReportsCard title="Recente meldingen" reports={data?.recent} emptyText="Nog geen meldingen." />
    </>
  );
}

/* ---------------- SHARED ---------------- */
function StatCard({
  icon: Icon, label, value, accent,
}: { icon: typeof Users; label: string; value: number | null | undefined; accent: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardDescription>{label}</CardDescription>
          <Icon className={`w-4 h-4 ${accent}`} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold">{value ?? "—"}</div>
      </CardContent>
    </Card>
  );
}

interface MiniReport {
  id: string; type: string; title: string; status: string; severity: string; observed_at: string;
}

function RecentReportsCard({ title, reports, emptyText }: { title: string; reports?: MiniReport[] | null; emptyText: string }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/meldingen">Bekijk alle <ArrowRight className="w-4 h-4" /></Link>
        </Button>
      </CardHeader>
      <CardContent>
        {!reports || reports.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-8">{emptyText}</div>
        ) : (
          <div className="space-y-1.5">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/50 transition-colors">
                <Badge variant="outline" className="w-24 justify-center shrink-0">{TYPE_LABELS[r.type] ?? r.type}</Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(r.observed_at).toLocaleDateString("nl-BE")}
                  </div>
                </div>
                <Badge variant={severityVariant(r.severity)}>{SEVERITY_LABELS[r.severity]}</Badge>
                <Badge variant="secondary" className="hidden sm:inline-flex">{STATUS_LABELS[r.status]}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
