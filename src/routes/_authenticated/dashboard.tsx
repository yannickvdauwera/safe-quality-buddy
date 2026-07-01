import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Users, FileText, AlertTriangle, ClipboardCheck, ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — HSE & Kwaliteit" }],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, roles } = useAuth();

  const { data: employeeCount } = useQuery({
    queryKey: ["employees-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("employees")
        .select("*", { count: "exact", head: true })
        .eq("active", true);
      return count ?? 0;
    },
  });

  const greeting = user?.user_metadata?.full_name?.split(" ")[0] ?? "welkom";
  const roleLabel =
    roles.includes("admin") ? "Beheerder"
    : roles.includes("hse_manager") ? "HSE-manager"
    : roles.includes("manager") ? "Manager"
    : "Operator";

  const modules = [
    { icon: FileText, title: "Documentenbeheer", desc: "Procedures & versies", status: "Fase 2", color: "text-blue-600" },
    { icon: AlertTriangle, title: "Meldingen", desc: "MOS, STOP, AO/EHBO, klachten", status: "Fase 3", color: "text-orange-600" },
    { icon: ClipboardCheck, title: "Toolboxen", desc: "Digitaal aftekenen", status: "Fase 4", color: "text-green-600" },
    { icon: ShieldAlert, title: "Risicoanalyses", desc: "RA-beheer met W/B/E/R", status: "Fase 4", color: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hallo {greeting}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Aangemeld als <span className="font-medium text-foreground">{roleLabel}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Actieve medewerkers</CardDescription>
              <Users className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold">{employeeCount ?? "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Open meldingen</CardDescription>
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-muted-foreground">—</div>
            <p className="text-xs text-muted-foreground mt-1">Beschikbaar in fase 3</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Documenten</CardDescription>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-muted-foreground">—</div>
            <p className="text-xs text-muted-foreground mt-1">Beschikbaar in fase 2</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardDescription>Actieve RA's</CardDescription>
              <ShieldAlert className="w-4 h-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-muted-foreground">—</div>
            <p className="text-xs text-muted-foreground mt-1">Beschikbaar in fase 4</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bouwplan van het platform</CardTitle>
          <CardDescription>
            Fase 1 (fundament) is nu actief. De overige modules bouwen we in de volgende fases.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {modules.map((m) => (
              <div key={m.title} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                <m.icon className={`w-5 h-5 mt-0.5 ${m.color}`} />
                <div className="flex-1">
                  <div className="font-medium text-sm">{m.title}</div>
                  <div className="text-xs text-muted-foreground">{m.desc}</div>
                </div>
                <span className="text-xs px-2 py-0.5 rounded-full bg-background border">{m.status}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
