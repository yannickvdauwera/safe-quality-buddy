import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Download, FileSpreadsheet, FileText, Pencil, Save, X } from "lucide-react";
import { STATUS_LABELS, SEVERITY_LABELS } from "@/components/ReportsList";
import { exportReportPdf, exportReportExcel, type ReportExport } from "@/lib/reports-export";

export const Route = createFileRoute("/_authenticated/meldingen/$id")({
  head: () => ({ meta: [{ title: "Melding — HSE & Kwaliteit" }] }),
  component: MeldingDetailPage,
  errorComponent: ({ error, reset }) => (
    <AppShell><div className="p-6 space-y-3">
      <p className="text-destructive">Er ging iets mis: {error.message}</p>
      <Button onClick={reset}>Opnieuw proberen</Button>
    </div></AppShell>
  ),
  notFoundComponent: () => (
    <AppShell><div className="p-6">Melding niet gevonden.</div></AppShell>
  ),
});

const TYPE_LABEL: Record<string, string> = {
  ao_ehbo: "Arbeidsongeval / EHBO",
  klacht: "Interne klacht",
  mos: "MOS-melding",
  stop: "STOP-reflex",
  werkplekinspectie: "Werkplekinspectie",
  kwaliteitscontrole: "Kwaliteitscontrole",
};

const AO_BODY_PARTS = [
  "Hoofd","Oog","Oor","Nek","Schouder","Bovenarm","Elleboog","Onderarm","Pols","Hand",
  "Vinger","Borstkas","Rug","Buik","Heup","Bovenbeen","Knie","Onderbeen","Enkel","Voet",
  "Teen","Meerdere / algemeen",
];

function MeldingDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "hse_manager", "manager"]);
  const [editing, setEditing] = useState(false);

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
    return <AppShell><div className="p-6">Melding niet gevonden. <Link to="/meldingen/ongevallen" className="underline">Terug</Link></div></AppShell>;
  }

  const details = (report.details ?? {}) as Record<string, string | undefined>;

  const handleExportPdf = async () => {
    try {
      await exportReportPdf(report as unknown as ReportExport);
    } catch (e) {
      toast.error("Export mislukt: " + (e as Error).message);
    }
  };
  const handleExportExcel = () => {
    try {
      exportReportExcel(report as unknown as ReportExport);
    } catch (e) {
      toast.error("Export mislukt: " + (e as Error).message);
    }
  };

  return (
    <AppShell>
      <div className="p-4 md:p-6 space-y-4 max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/meldingen/ongevallen" })}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Terug
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={handleExportPdf}>
              <FileText className="w-4 h-4 mr-2" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="w-4 h-4 mr-2" /> Excel
            </Button>
            {canManage && !editing && (
              <Button size="sm" onClick={() => setEditing(true)}>
                <Pencil className="w-4 h-4 mr-2" /> Bewerken
              </Button>
            )}
          </div>
        </div>

        {editing ? (
          <EditForm
            report={report}
            onCancel={() => setEditing(false)}
            onSaved={async () => {
              await qc.invalidateQueries({ queryKey: ["report", id] });
              await qc.invalidateQueries({ queryKey: ["reports-meldingen-ongevallen"] });
              setEditing(false);
              toast.success("Melding bijgewerkt");
            }}
          />
        ) : (
          <>
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
                    <Badge variant={report.status === "open" ? "destructive" : "secondary"}>
                      {STATUS_LABELS[report.status] ?? report.status}
                    </Badge>
                    <Badge variant={report.severity === "kritiek" || report.severity === "hoog" ? "destructive" : "outline"}>
                      Ernst: {SEVERITY_LABELS[report.severity] ?? report.severity}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid md:grid-cols-2 gap-x-8 gap-y-3 text-sm">
                <Field label="Datum incident" value={fmtDate(details.incident_date || report.observed_at)} />
                <Field label="Type incident" value={details.incident_type} />
                <Field label="Slachtoffernaam" value={details.victim_name} />
                <Field label="Type contract" value={details.contract_type} />
                <Field label="Hulpverlener" value={details.first_aider} />
                <Field label="Locatie" value={report.location} />
                <Field label="Betrokken firma" value={report.involved_firm} />
                <Field label="Lichaamsdeel" value={details.body_part} />
                <Field label="Detail lichaamsdeel" value={details.body_detail} full />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Relaas</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{details.relaas ?? "—"}</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Ongevallenonderzoek</CardTitle></CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{details.investigation ?? "—"}</p>
              </CardContent>
            </Card>

            {report.follow_up_notes && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Opvolging</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.follow_up_notes}</p>
                </CardContent>
              </Card>
            )}

            <Attachments report={report} />
          </>
        )}
      </div>
    </AppShell>
  );
}

function Field({ label, value, full }: { label: string; value?: string | null; full?: boolean }) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5">{value?.trim() ? value : "—"}</p>
    </div>
  );
}

function fmtDate(iso?: string | null) {
  return iso ? new Date(iso).toLocaleDateString("nl-BE") : "—";
}

function Attachments({ report }: { report: { id: string; details: unknown } }) {
  const atts = ((report.details as { attachments?: Array<{ path: string; name: string; type: string }> })?.attachments) ?? [];
  if (!atts.length) return null;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">Bijlagen</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {atts.map((a) => (
          <button
            key={a.path}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
            onClick={async () => {
              const { data } = await supabase.storage.from("reports-attachments").createSignedUrl(a.path, 300);
              if (data?.signedUrl) window.open(data.signedUrl, "_blank");
            }}
          >
            <Download className="w-4 h-4" /> {a.name}
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

// -------- Edit form (AO/EHBO — same fields as create) --------
function EditForm({
  report, onCancel, onSaved,
}: {
  report: {
    id: string; title: string; severity: string; status: string;
    location: string | null; involved_firm: string | null;
    follow_up_notes: string | null; details: unknown; observed_at: string;
  };
  onCancel: () => void;
  onSaved: () => void;
}) {
  const d = (report.details ?? {}) as Record<string, string | undefined>;
  const [saving, setSaving] = useState(false);
  const [state, setState] = useState({
    title: report.title,
    severity: report.severity,
    status: report.status,
    location: report.location ?? "",
    involved_firm: report.involved_firm ?? "",
    follow_up_notes: report.follow_up_notes ?? "",
    incident_date: (d.incident_date as string) || report.observed_at.slice(0, 10),
    incident_type: d.incident_type ?? "",
    victim_name: d.victim_name ?? "",
    contract_type: d.contract_type ?? "",
    first_aider: d.first_aider ?? "",
    body_part: d.body_part ?? "",
    body_detail: d.body_detail ?? "",
    relaas: d.relaas ?? "",
    investigation: d.investigation ?? "",
  });

  const set = <K extends keyof typeof state>(k: K, v: (typeof state)[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  const save = async () => {
    setSaving(true);
    const newDetails = {
      ...(report.details as Record<string, unknown>),
      incident_date: state.incident_date,
      incident_type: state.incident_type,
      victim_name: state.victim_name,
      contract_type: state.contract_type,
      first_aider: state.first_aider,
      body_part: state.body_part,
      body_detail: state.body_detail,
      relaas: state.relaas,
      investigation: state.investigation,
    };
    const { error } = await supabase.from("reports").update({
      title: state.title,
      severity: state.severity as never,
      status: state.status as never,
      location: state.location || null,
      involved_firm: state.involved_firm || null,
      follow_up_notes: state.follow_up_notes || null,
      observed_at: new Date(state.incident_date).toISOString(),
      details: newDetails as never,
    }).eq("id", report.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    onSaved();
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Melding bewerken</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Titel</Label>
          <Input value={state.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3">

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={state.status} onValueChange={(v) => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="in_behandeling">In behandeling</SelectItem>
                <SelectItem value="opgevolgd">Opgevolgd</SelectItem>
                <SelectItem value="gesloten">Gesloten</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Datum incident</Label>
            <Input type="date" value={state.incident_date} onChange={(e) => set("incident_date", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Type incident</Label>
            <Select value={state.incident_type} onValueChange={(v) => set("incident_type", v)}>
              <SelectTrigger><SelectValue placeholder="Kies…" /></SelectTrigger>
              <SelectContent>
                {["Arbeidsongeval met werkverlet","Arbeidsongeval zonder werkverlet","EHBO","Bijna-ongeval","Verkeersongeval woon-werk"].map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Slachtoffernaam</Label>
            <Input value={state.victim_name} onChange={(e) => set("victim_name", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Hulpverlener</Label>
            <Input value={state.first_aider} onChange={(e) => set("first_aider", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Type contract</Label>
            <Select value={state.contract_type} onValueChange={(v) => set("contract_type", v)}>
              <SelectTrigger><SelectValue placeholder="Kies…" /></SelectTrigger>
              <SelectContent>
                {["Vast — TSA","Interim","Onderaannemer","Stagiair","Zelfstandige"].map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Locatie</Label>
            <Input value={state.location} onChange={(e) => set("location", e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Lichaamsdeel</Label>
            <Select value={state.body_part} onValueChange={(v) => set("body_part", v)}>
              <SelectTrigger><SelectValue placeholder="Kies…" /></SelectTrigger>
              <SelectContent>
                {AO_BODY_PARTS.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Betrokken firma</Label>
            <Input value={state.involved_firm} onChange={(e) => set("involved_firm", e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Detail gekwetste lichaamsdelen</Label>
          <Input value={state.body_detail} onChange={(e) => set("body_detail", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Relaas</Label>
          <Textarea rows={4} value={state.relaas} onChange={(e) => set("relaas", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Ongevallenonderzoek</Label>
          <Textarea rows={3} value={state.investigation} onChange={(e) => set("investigation", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Opvolgingsnotities</Label>
          <Textarea rows={3} value={state.follow_up_notes} onChange={(e) => set("follow_up_notes", e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onCancel}><X className="w-4 h-4 mr-2" /> Annuleren</Button>
          <Button onClick={save} disabled={saving}><Save className="w-4 h-4 mr-2" /> Opslaan</Button>
        </div>
      </CardContent>
    </Card>
  );
}
