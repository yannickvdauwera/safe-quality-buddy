import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
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
  evaluator_signature: string | null;
};

function EmployeeDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const canEvaluate = hasAnyRole(["admin", "hse_manager", "manager"]);
  const canViewEvaluations = hasAnyRole(["admin", "hse_manager", "manager"]);
  const canEdit = hasAnyRole(["admin", "hse_manager", "manager"]);
  const canDelete = hasAnyRole(["admin"]);
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Evaluation | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editFicheOpen, setEditFicheOpen] = useState(false);

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
        .select("id, signed_at, session:toolbox_sessions(id, given_at, scheduled_at, location, toolbox:toolboxes(title))")
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
        .select("id, type, observed_date, plant, area, location, status, situation_description")
        .eq("reporter_id", employee!.user_id!)
        .order("observed_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: reporterReports = [] } = useQuery({
    enabled: !!employee?.user_id,
    queryKey: ["employee-reporter-reports", employee?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("id, type, title, severity, status, observed_at, location, involved_firm")
        .eq("reporter_id", employee!.user_id!)
        .in("type", ["ao_ehbo", "klacht"])
        .order("observed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  type MeldingItem = {
    id: string;
    kind: "mos" | "stop" | "ao_ehbo" | "klacht";
    label: string;
    date: string;
    title: string;
    subtitle: string;
    status: string;
    severity?: string | null;
    onOpen: () => void;
  };

  const KIND_LABEL: Record<MeldingItem["kind"], string> = {
    mos: "MOS-melding",
    stop: "STOP-reflex",
    ao_ehbo: "(Bijna)ongeval",
    klacht: "Interne melding",
  };

  const meldingen: MeldingItem[] = [
    ...observations.map((o): MeldingItem => ({
      id: o.id,
      kind: (o.type === "stop" ? "stop" : "mos") as MeldingItem["kind"],
      label: o.type === "stop" ? KIND_LABEL.stop : KIND_LABEL.mos,
      date: o.observed_date,
      title: (o.situation_description ?? "").slice(0, 100) || (o.type === "stop" ? "STOP-reflex" : "MOS-melding"),
      subtitle: [o.plant, o.area, o.location].filter(Boolean).join(" · "),
      status: o.status ?? "open",
      severity: null,
      onOpen: () => toast.message("Detailweergave voor MOS/STOP komt binnenkort."),
    })),
    ...reporterReports.map((r): MeldingItem => ({
      id: r.id,
      kind: (r.type as MeldingItem["kind"]),
      label: KIND_LABEL[r.type as MeldingItem["kind"]] ?? r.type,
      date: r.observed_at,
      title: r.title,
      subtitle: [r.location, r.involved_firm].filter(Boolean).join(" · "),
      status: r.status,
      severity: r.severity,
      onOpen: () => navigate({ to: "/meldingen/$id", params: { id: r.id } }),
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const [meldingFilter, setMeldingFilter] = useState<"all" | MeldingItem["kind"]>("all");
  const filteredMeldingen = meldingFilter === "all" ? meldingen : meldingen.filter((m) => m.kind === meldingFilter);
  const meldingCounts = {
    all: meldingen.length,
    mos: meldingen.filter((m) => m.kind === "mos").length,
    stop: meldingen.filter((m) => m.kind === "stop").length,
    ao_ehbo: meldingen.filter((m) => m.kind === "ao_ehbo").length,
    klacht: meldingen.filter((m) => m.kind === "klacht").length,
  };




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

  const saveFiche = useMutation({
    mutationFn: async (payload: {
      first_name: string; last_name: string; employer: string | null;
      email: string | null; phone: string | null; function_title: string | null; active: boolean;
    }) => {
      const { error } = await supabase.from("employees").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fiche bijgewerkt");
      qc.invalidateQueries({ queryKey: ["employee", id] });
      qc.invalidateQueries({ queryKey: ["employees"] });
      setEditFicheOpen(false);
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
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="fiche">Fiche</TabsTrigger>
          {canViewEvaluations && (
            <TabsTrigger value="evaluaties">
              Evaluaties{evaluations.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({evaluations.length})</span>}
            </TabsTrigger>
          )}
          <TabsTrigger value="inspecties">
            Inspecties{subjectReports.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({subjectReports.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="toolboxen">
            Toolboxen{toolboxes.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({toolboxes.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="meldingen">
            Meldingen{meldingen.length > 0 && <span className="ml-1 text-xs text-muted-foreground">({meldingen.length})</span>}
          </TabsTrigger>
        </TabsList>


        <TabsContent value="fiche">
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Gegevens</CardTitle>
              {canEdit && (
                <Button size="sm" variant="outline" onClick={() => setEditFicheOpen(true)}>
                  <Pencil className="w-4 h-4" /> Bewerken
                </Button>
              )}
            </CardHeader>
            <CardContent className="p-6 pt-0 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
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

          <Dialog open={editFicheOpen} onOpenChange={setEditFicheOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Fiche bewerken</DialogTitle>
                <DialogDescription>Wijzig de gegevens van deze medewerker.</DialogDescription>
              </DialogHeader>
              <form
                id="edit-fiche-form"
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  const str = (k: string) => (fd.get(k) as string | null)?.trim() || "";
                  const first = str("first_name").replace(/,/g, "").trim();
                  const last = str("last_name").replace(/,/g, "").trim();
                  if (!first || !last) return toast.error("Voornaam en naam zijn verplicht");
                  saveFiche.mutate({
                    first_name: first,
                    last_name: last,
                    employer: str("employer") || null,
                    email: str("email").toLowerCase() || null,
                    phone: str("phone") || null,
                    function_title: str("function_title") || null,
                    active: (fd.get("active") as string) === "on",
                  });
                }}
              >
                <div className="space-y-1">
                  <Label htmlFor="ef_first_name">Voornaam *</Label>
                  <Input id="ef_first_name" name="first_name" defaultValue={employee.first_name ?? ""} required maxLength={100} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ef_last_name">Naam *</Label>
                  <Input id="ef_last_name" name="last_name" defaultValue={employee.last_name ?? ""} required maxLength={100} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ef_employer">Werkgever</Label>
                  <Input id="ef_employer" name="employer" defaultValue={employee.employer ?? ""} maxLength={200} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ef_email">E-mail</Label>
                  <Input id="ef_email" name="email" type="email" defaultValue={employee.email ?? ""} maxLength={200} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ef_phone">Telefoon</Label>
                  <Input id="ef_phone" name="phone" defaultValue={employee.phone ?? ""} maxLength={50} />
                </div>
                <div className="space-y-1 md:col-span-2">
                  <Label htmlFor="ef_function_title">Functies (komma-gescheiden)</Label>
                  <Input
                    id="ef_function_title"
                    name="function_title"
                    defaultValue={employee.function_title ?? ""}
                    placeholder="bv. Brandwacht, Gasanalist"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm md:col-span-2">
                  <input type="checkbox" name="active" defaultChecked={employee.active ?? true} className="accent-primary" />
                  Actief in dienst
                </label>
              </form>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditFicheOpen(false)}>Annuleren</Button>
                <Button type="submit" form="edit-fiche-form" disabled={saveFiche.isPending}>
                  {saveFiche.isPending ? "Opslaan…" : "Opslaan"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>


        <TabsContent value="inspecties" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Werkplekinspecties en kwaliteitscontroles waarbij deze medewerker geobserveerd werd.
          </p>
          {subjectReports.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Nog geen inspecties gekoppeld aan deze medewerker.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {subjectReports.map((r) => (
                <Card
                  key={r.id}
                  className="cursor-pointer hover:bg-muted/40 transition"
                  onClick={() => navigate({ to: "/meldingen/$id", params: { id: r.id } })}
                >
                  <CardContent className="p-3 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{r.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {r.type} · {new Date(r.observed_at).toLocaleDateString("nl-BE")}
                        {r.location ? ` · ${r.location}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">{r.severity}</Badge>
                      <Badge variant="secondary" className="text-xs">{r.status}</Badge>
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="toolboxen" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Toolboxen die door deze medewerker ondertekend zijn.
          </p>
          {toolboxes.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <PresentationIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Nog geen ondertekende toolboxen.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {toolboxes.map((t) => {
                const s = (t as unknown as {
                  session: { id: string; given_at: string | null; scheduled_at: string | null; location: string | null; toolbox: { title: string } | null } | null;
                }).session;
                const title = s?.toolbox?.title ?? "Toolbox-sessie";
                const when = s?.given_at ?? s?.scheduled_at ?? null;
                return (
                  <Card
                    key={t.id}
                    className="cursor-pointer hover:bg-muted/40 transition"
                    onClick={() => s && navigate({ to: "/toolboxes/sessions/$id", params: { id: s.id } })}
                  >
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-medium">{title}</div>
                        <div className="text-xs text-muted-foreground">
                          {when ? new Date(when).toLocaleDateString("nl-BE") : "—"}
                          {s?.location ? ` · ${s.location}` : ""}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Ondertekend {new Date(t.signed_at).toLocaleDateString("nl-BE")}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

            </div>
          )}
        </TabsContent>

        <TabsContent value="meldingen" className="space-y-3">
          <p className="text-sm text-muted-foreground">
            MOS-meldingen, STOP-reflexen, interne meldingen en (bijna)ongevallen ingediend door deze medewerker.
            {" "}Elke melding behoudt zijn eigen datavelden — klik door om alle details te zien.
          </p>

          {!employee.user_id ? (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                Deze medewerker heeft nog geen gekoppeld gebruikersaccount. Meldingen worden pas zichtbaar zodra de fiche gekoppeld is aan een login.
              </CardContent>
            </Card>
          ) : meldingen.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                <MessageSquareWarning className="w-8 h-8 mx-auto mb-2 opacity-50" />
                Nog geen meldingen door deze medewerker.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {([
                  ["all", "Alle"],
                  ["mos", "MOS"],
                  ["stop", "STOP"],
                  ["klacht", "Intern"],
                  ["ao_ehbo", "(Bijna)ongevallen"],
                ] as const).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={meldingFilter === key ? "default" : "outline"}
                    onClick={() => setMeldingFilter(key)}
                  >
                    {label} ({meldingCounts[key]})
                  </Button>
                ))}
              </div>

              {filteredMeldingen.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center text-sm text-muted-foreground">
                    Geen meldingen in deze filter.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {filteredMeldingen.map((m) => (
                    <Card
                      key={`${m.kind}-${m.id}`}
                      className="cursor-pointer hover:bg-muted/40 transition"
                      onClick={m.onOpen}
                    >
                      <CardContent className="p-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs shrink-0">{m.label}</Badge>
                            <div className="text-sm font-medium truncate">{m.title}</div>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {new Date(m.date).toLocaleDateString("nl-BE")}
                            {m.subtitle ? ` · ${m.subtitle}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {m.severity && <Badge variant="outline" className="text-xs">{m.severity}</Badge>}
                          <Badge variant="secondary" className="text-xs">{m.status}</Badge>
                          <ExternalLink className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
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
                        {ev.evaluator_signature && (
                          <div>
                            <div className="text-sm font-medium mb-1">Handtekening leidinggevende</div>
                            <div className="border rounded-md bg-white p-2 inline-block">
                              <img src={ev.evaluator_signature} alt="Handtekening" className="max-h-32" />
                            </div>
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
