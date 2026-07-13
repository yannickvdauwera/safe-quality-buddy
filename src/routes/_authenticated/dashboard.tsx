import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle, CheckCircle2, Clock, ShieldAlert, ArrowRight,
  TrendingUp, Calendar as CalendarIcon,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";

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
  open: "Open", in_behandeling: "In behandeling", opgevolgd: "Opgevolgd", gesloten: "Gesloten",
};
const SEVERITY_LABELS: Record<string, string> = {
  laag: "Laag", middel: "Middel", hoog: "Hoog", kritiek: "Kritiek",
};
const SEVERITY_ORDER = ["laag", "middel", "hoog", "kritiek"] as const;
const SEVERITY_COLORS: Record<string, string> = {
  laag: "hsl(142 71% 45%)",
  middel: "hsl(38 92% 50%)",
  hoog: "hsl(25 95% 53%)",
  kritiek: "hsl(0 84% 60%)",
};
const TYPE_COLORS = [
  "hsl(217 91% 60%)", "hsl(262 83% 58%)", "hsl(142 71% 45%)",
  "hsl(38 92% 50%)", "hsl(0 84% 60%)", "hsl(199 89% 48%)", "hsl(291 64% 42%)",
];

const severityVariant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
  s === "kritiek" ? "destructive" : s === "hoog" ? "default" : s === "middel" ? "secondary" : "outline";

function pickRole(roles: AppRole[]): AppRole {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("hse_manager")) return "hse_manager";
  if (roles.includes("manager")) return "manager";
  return "operator";
}

interface Report {
  id: string; type: string; title: string; status: string; severity: string;
  observed_at: string; deadline: string | null; assigned_to: string | null; reporter_id: string | null;
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

      <DashboardContent userId={user.id} role={primaryRole} />
    </div>
  );
}

function DashboardContent({ userId, role }: { userId: string; role: AppRole }) {
  const { data: reports, isLoading } = useQuery({
    queryKey: ["dashboard-reports", role, userId],
    queryFn: async (): Promise<Report[]> => {
      const { data } = await supabase
        .from("reports")
        .select("id, type, title, status, severity, observed_at, deadline, assigned_to, reporter_id")
        .order("observed_at", { ascending: false });
      return (data ?? []) as Report[];
    },
  });

  const scope = useMemo(() => {
    if (!reports) return [];
    if (role === "operator") return reports.filter((r) => r.reporter_id === userId);
    if (role === "manager") return reports.filter((r) => r.assigned_to === userId || r.reporter_id === userId);
    return reports;
  }, [reports, role, userId]);

  const metrics = useMemo(() => {
    const now = Date.now();
    const open = scope.filter((r) => r.status !== "gesloten" && r.status !== "opgevolgd");
    const overdue = open.filter((r) => r.deadline && new Date(r.deadline).getTime() < now);
    const critical = open.filter((r) => r.severity === "hoog" || r.severity === "kritiek");
    const last30 = scope.filter((r) => new Date(r.observed_at).getTime() >= now - 30 * 864e5);
    return {
      total: scope.length,
      open: open.length,
      overdue: overdue.length,
      critical: critical.length,
      last30: last30.length,
    };
  }, [scope]);

  const trend = useMemo(() => {
    const weeks: { label: string; start: number; end: number; count: number }[] = [];
    const now = new Date();
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    for (let i = 11; i >= 0; i--) {
      const s = new Date(monday); s.setDate(s.getDate() - i * 7);
      const e = new Date(s); e.setDate(e.getDate() + 7);
      weeks.push({
        label: `${s.getDate()}/${s.getMonth() + 1}`,
        start: s.getTime(), end: e.getTime(), count: 0,
      });
    }
    scope.forEach((r) => {
      const t = new Date(r.observed_at).getTime();
      const w = weeks.find((w) => t >= w.start && t < w.end);
      if (w) w.count++;
    });
    return weeks.map(({ label, count }) => ({ label, count }));
  }, [scope]);

  const byType = useMemo(() => {
    const m: Record<string, number> = {};
    scope.forEach((r) => { m[r.type] = (m[r.type] ?? 0) + 1; });
    return Object.entries(m).map(([k, v]) => ({ name: TYPE_LABELS[k] ?? k, value: v }));
  }, [scope]);

  const bySeverity = useMemo(() => {
    const m: Record<string, number> = {};
    scope.forEach((r) => { m[r.severity] = (m[r.severity] ?? 0) + 1; });
    return SEVERITY_ORDER.map((s) => ({ name: SEVERITY_LABELS[s], key: s, value: m[s] ?? 0 }));
  }, [scope]);

  const actions = useMemo(() => {
    let list = scope.filter((r) => r.status !== "gesloten" && r.status !== "opgevolgd");
    if (role === "manager") list = list.filter((r) => r.assigned_to === userId);
    // Sort: overdue first, then by severity (kritiek→laag), then by deadline asc
    const sevRank = (s: string) => ({ kritiek: 0, hoog: 1, middel: 2, laag: 3 }[s] ?? 4);
    const now = Date.now();
    list.sort((a, b) => {
      const ao = a.deadline && new Date(a.deadline).getTime() < now ? 0 : 1;
      const bo = b.deadline && new Date(b.deadline).getTime() < now ? 0 : 1;
      if (ao !== bo) return ao - bo;
      const sv = sevRank(a.severity) - sevRank(b.severity);
      if (sv !== 0) return sv;
      const ad = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const bd = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return ad - bd;
    });
    return list.slice(0, 8);
  }, [scope, role, userId]);

  const actionsTitle =
    role === "operator" ? "Mijn openstaande meldingen"
    : role === "manager" ? "Aan mij toegewezen — openstaand"
    : "Openstaande acties (prioriteit)";

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Cijfers laden…</div>;
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard icon={AlertTriangle} label="Totaal" value={metrics.total} accent="text-blue-600" />
        <StatCard icon={Clock} label="Open" value={metrics.open} accent="text-orange-600" />
        <StatCard icon={CalendarIcon} label="Deadline verstreken" value={metrics.overdue} accent="text-red-600" />
        <StatCard icon={ShieldAlert} label="Hoog/kritiek open" value={metrics.critical} accent="text-red-600" />
        <StatCard icon={TrendingUp} label="Laatste 30 dagen" value={metrics.last30} accent="text-green-600" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Meldingen per week (12 weken)</CardTitle>
            <CardDescription>Evolutie van het aantal geregistreerde meldingen</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Line type="monotone" dataKey="count" stroke="hsl(217 91% 60%)" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verdeling per type</CardTitle>
            <CardDescription>Alle meldingen in scope</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {byType.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Geen data</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byType} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                    {byType.map((_, i) => (<Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />))}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ernst</CardTitle>
            <CardDescription>Verdeling per ernstniveau</CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySeverity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={12} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                  {bySeverity.map((d, i) => (<Cell key={i} fill={SEVERITY_COLORS[d.key]} />))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-base">{actionsTitle}</CardTitle>
              <CardDescription>Overdue en hoge ernst eerst</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/meldingen">Alle meldingen <ArrowRight className="w-4 h-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {actions.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8 flex flex-col items-center gap-2">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
                Geen openstaande acties — goed werk.
              </div>
            ) : (
              <div className="space-y-1.5">
                {actions.map((r) => {
                  const overdue = r.deadline && new Date(r.deadline).getTime() < Date.now();
                  return (
                    <Link
                      key={r.id}
                      to="/meldingen/$id"
                      params={{ id: r.id }}
                      className="flex items-center gap-3 p-2.5 rounded-md hover:bg-muted/50 transition-colors"
                    >
                      <Badge variant="outline" className="w-24 justify-center shrink-0">{TYPE_LABELS[r.type] ?? r.type}</Badge>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{r.title}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          {r.deadline ? (
                            <span className={overdue ? "text-red-600 font-medium" : ""}>
                              Deadline {new Date(r.deadline).toLocaleDateString("nl-BE")}
                              {overdue ? " — verstreken" : ""}
                            </span>
                          ) : (
                            <span>Geen deadline</span>
                          )}
                        </div>
                      </div>
                      <Badge variant={severityVariant(r.severity)}>{SEVERITY_LABELS[r.severity]}</Badge>
                      <Badge variant="secondary" className="hidden sm:inline-flex">{STATUS_LABELS[r.status]}</Badge>
                    </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function StatCard({
  icon: Icon, label, value, accent,
}: { icon: typeof AlertTriangle; label: string; value: number | null | undefined; accent: string }) {
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
