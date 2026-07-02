import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Pencil, Trash2, ClipboardList, ClipboardCheck, MessageSquareWarning, PresentationIcon, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { EvaluationForm } from "@/components/EvaluationForm";
import { EVALUATION_SECTIONS, SCORE_OPTIONS, evaluationAverage } from "@/lib/evaluation-criteria";

export const Route = createFileRoute("/_authenticated/employees/$id")({
  head: () => ({ meta: [{ title: "Personeelsfiche — HSE & Kwaliteit" }] }),
  component: EmployeeDetailPage,
});

type Evaluation = {
  id: string;
  employee_id: string;
  evaluator_name: string;
  employee_name: string;
  location: string;
  scores: Record<string, string>;
  notes: string | null;
  evaluated_on: string;
  created_at: string;
};

function EmployeeDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const canEvaluate = hasAnyRole(["admin", "hse_manager", "manager"]);
  const canDelete = hasAnyRole(["admin"]);
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Evaluation | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: employee, isLoading } = useQuery({
    queryKey: ["employee", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("employees").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: evaluations = [] } = useQuery({
    queryKey: ["employee-evaluations", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_evaluations")
        .select("*")
        .eq("employee_id", id)
        .order("evaluated_on", { ascending: false });
      if (error) throw error;
      return data as Evaluation[];
    },
  });

  const { data: subjectReports = [] } = useQuery({
    queryKey: ["employee-subject-reports", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, type, title, severity, status, observed_at, location")
        .filter("details->header->>subject_employee_id", "eq", id)
        .order("observed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: toolboxes = [] } = useQuery({
    queryKey: ["employee-toolboxes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("toolbox_signatures")
        .select("id, signed_at, session:toolbox_sessions(id, title, session_date, location)")
        .eq("employee_id", id)
        .order("signed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: observations = [] } = useQuery({
    enabled: !!employee?.user_id,
    queryKey: ["employee-observations", employee?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("safety_observations")
        .select("id, type, observed_date, plant, area, location, status")
        .eq("reporter_id", employee!.user_id!)
        .order("observed_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });



  const remove = useMutation({
    mutationFn: async (evalId: string) => {
      const { error } = await supabase.from("employee_evaluations").delete().eq("id", evalId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Evaluatie verwijderd");
      qc.invalidateQueries({ queryKey: ["employee-evaluations", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-muted-foreground">Laden…</div>;
  if (!employee) return <div className="text-muted-foreground">Fiche niet gevonden.</div>;

  const employeeName = `${employee.first_name ?? ""} ${employee.last_name ?? ""}`.trim();
  const functies = (employee.function_title ?? "")
    .split(",")
    .map((s: string) => s.trim())
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/employees" })}>
            <ArrowLeft className="w-4 h-4" /> Terug
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">{employeeName}</h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {employee.employer && <span>{employee.employer}</span>}
            {employee.active ? <Badge variant="secondary">Actief</Badge> : <Badge variant="outline">Uit dienst</Badge>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="fiche" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fiche">Fiche</TabsTrigger>
          <TabsTrigger value="evaluaties">
            Evaluaties {evaluations.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({evaluations.length})</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fiche">
          <Card>
            <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <InfoRow label="Voornaam" value={employee.first_name} />
              <InfoRow label="Naam" value={employee.last_name} />
              <InfoRow label="Werkgever" value={employee.employer} />
              <InfoRow label="E-mail" value={employee.email} />
              <InfoRow label="Telefoon" value={employee.phone} />
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground">Functies</div>
                {functies.length === 0 ? (
                  <div>—</div>
                ) : (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {functies.map((f: string) => (
                      <Badge key={f} variant="secondary" className="font-normal">{f}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="evaluaties" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Overzicht van alle evaluaties voor deze medewerker.
            </p>
            {canEvaluate && (
              <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
                <Plus className="w-4 h-4" /> Nieuwe evaluatie
              </Button>
            )}
          </div>

          {evaluations.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Nog geen evaluaties voor deze medewerker.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {evaluations.map((ev) => {
                const avg = evaluationAverage(ev.scores);
                const expanded = expandedId === ev.id;
                return (
                  <Card key={ev.id}>
                    <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                      <div>
                        <CardTitle className="text-base">
                          Evaluatie {new Date(ev.evaluated_on).toLocaleDateString("nl-BE")}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          Door {ev.evaluator_name} · {ev.location}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {avg !== null && (
                          <Badge variant="secondary" className="text-sm">
                            Gemiddeld: {avg.toFixed(2)}/3
                          </Badge>
                        )}
                        {canEvaluate && (
                          <Button variant="ghost" size="icon" onClick={() => { setEditing(ev); setDialogOpen(true); }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Evaluatie definitief verwijderen?")) remove.mutate(ev.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setExpandedId(expanded ? null : ev.id)}>
                          {expanded ? "Verbergen" : "Bekijken"}
                        </Button>
                      </div>
                    </CardHeader>
                    {expanded && (
                      <CardContent className="space-y-3">
                        {EVALUATION_SECTIONS.map((section) => (
                          <div key={section.key}>
                            <div className="text-sm font-medium mb-1">{section.title}</div>
                            <div className="space-y-1">
                              {section.items.map((item) => {
                                const val = ev.scores[item.key];
                                const opt = SCORE_OPTIONS.find((o) => o.value === val);
                                return (
                                  <div key={item.key} className="flex items-start gap-2 text-sm">
                                    <span className="text-muted-foreground w-10 shrink-0">{item.key}</span>
                                    <span className="flex-1">{item.label}</span>
                                    <Badge variant="outline" className="shrink-0">{opt?.short ?? "—"}</Badge>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                        {ev.notes && (
                          <div>
                            <div className="text-sm font-medium mb-1">Duiding &amp; Nuancering</div>
                            <p className="text-sm whitespace-pre-wrap">{ev.notes}</p>
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {dialogOpen && (
        <EvaluationForm
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          employeeId={id}
          employeeName={employeeName}
          existing={editing}
        />
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div>{value || "—"}</div>
    </div>
  );
}
