import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, FileSpreadsheet, FileText } from "lucide-react";
import { STATUS_LABELS } from "@/components/ReportsList";
import { exportReportPdf, exportReportExcel, type ReportExport } from "@/lib/reports-export";
import { WPI_CONFIG, KWALITEIT_CONFIG } from "@/components/inspection-configs";
import type { ChecklistConfig } from "@/components/ChecklistCreateForm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inspecties/$id")({
  head: () => ({ meta: [{ title: "Inspectie — HSE & Kwaliteit" }] }),
  component: InspectionDetailPage,
  errorComponent: ({ error, reset }) => (
    <AppShell><div className="p-6 space-y-3">
      <p className="text-destructive">Er ging iets mis: {error.message}</p>
      <Button onClick={reset}>Opnieuw proberen</Button>
    </div></AppShell>
  ),
  notFoundComponent: () => (
    <AppShell><div className="p-6">Inspectie niet gevonden.</div></AppShell>
  ),
});

const TYPE_LABEL: Record<string, string> = {
  werkplekinspectie: "Werkplekinspectie",
  kwaliteitscontrole: "Kwaliteitscontrole",
};

const ANSWER_BADGE: Record<string, { label: string; cls: string }> = {
  ok:  { label: "OK",  cls: "bg-emerald-600 text-white" },
  nok: { label: "NOK", cls: "bg-destructive text-destructive-foreground" },
  nvt: { label: "NVT", cls: "bg-muted text-foreground" },
};

function InspectionDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return <AppShell><div className="p-6 text-muted-foreground">Laden…</div></AppShell>;
  }
  if (!report) {
    return <AppShell><div className="p-6">Inspectie niet gevonden. <Link to="/inspecties/wpi" className="underline">Terug</Link></div></AppShell>;
  }

  const config: ChecklistConfig | null =
    report.type === "werkplekinspectie" ? WPI_CONFIG :
    report.type === "kwaliteitscontrole" ? KWALITEIT_CONFIG : null;

  const details = (report.details ?? {}) as {
    header?: Record<string, string>;
    answers?: Record<string, "ok" | "nok" | "nvt">;
    extras?: Record<string, string>;
    signature?: string | null;
    stats?: { total: number; answered: number; nok: number };
  };
  const header = details.header ?? {};
  const answers = details.answers ?? {};
  const extras = details.extras ?? {};

  const backTo = report.type === "kwaliteitscontrole" ? "/inspecties/kwaliteit" : "/inspecties/wpi";

  const handleExportPdf = async () => {
    try { await exportReportPdf(report as unknown as ReportExport); }
    catch (e) { toast.error("Export mislukt: " + (e as Error).message); }
  };
  const handleExportExcel = () => {
    try { exportReportExcel(report as unknown as ReportExport); }
    catch (e) { toast.error("Export mislukt: " + (e as Error).message); }
  };

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: backTo })}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Terug
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {TYPE_LABEL[report.type] ?? report.type} · Ref {report.id.slice(0, 8).toUpperCase()}
                </p>
                <CardTitle className="text-xl mt-1">{report.title}</CardTitle>
              </div>
              <div className="flex flex-wrap gap-2">
                {details.stats && (
                  <Badge variant="outline">
                    {details.stats.answered}/{details.stats.total} beantwoord · {details.stats.nok} NOK
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          {config && (
            <CardContent className="grid md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
              {config.headerFields.map((f) => (
                <Field
                  key={f.key}
                  label={f.label}
                  value={header[f.key]}
                />
              ))}
            </CardContent>
          )}
        </Card>

        {config ? (
          config.sections.map((sec) => (
            <Card key={sec.title}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{sec.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sec.questions.map((q) => {
                  const a = answers[q.key];
                  const badge = a ? ANSWER_BADGE[a] : null;
                  return (
                    <div key={q.key} className="flex items-start justify-between gap-3 border rounded-md p-2.5">
                      <div className="text-sm flex-1 leading-snug">{q.label}</div>
                      <span
                        className={cn(
                          "px-2.5 py-1 rounded text-xs font-medium border shrink-0",
                          badge ? badge.cls : "bg-background text-muted-foreground",
                        )}
                      >
                        {badge ? badge.label : "—"}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Onbekend inspectietype.</CardContent></Card>
        )}

        {config?.extraTextFields && config.extraTextFields.some((f) => extras[f.key]?.trim()) && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Vaststellingen</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {config.extraTextFields.map((f) =>
                extras[f.key]?.trim() ? (
                  <div key={f.key}>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{f.label}</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed mt-0.5">{extras[f.key]}</p>
                    <Separator className="mt-3" />
                  </div>
                ) : null,
              )}
            </CardContent>
          </Card>
        )}

        {details.signature && (
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Handtekening uitvoerder</CardTitle></CardHeader>
            <CardContent>
              <img src={details.signature} alt="Handtekening" className="h-24 border rounded bg-white" />
            </CardContent>
          </Card>
        )}
      </div>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value?.trim() ? value : "—"}</p>
    </div>
  );
}
