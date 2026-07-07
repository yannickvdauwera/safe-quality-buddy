import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Upload, Save, Loader2, ArrowLeft, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { TYPE_LABELS, METHOD_LABELS, levelsFor, type RiskAnalysisType, type RiskMethod } from "@/lib/risk-analysis-types";
import { parseMondayExport, type ParsedRiskAnalysis } from "@/lib/risk-analysis-excel";
import { toast } from "sonner";
import { z } from "zod";
import { cn } from "@/lib/utils";

const searchSchema = z.object({ mode: z.enum(["manual", "import"]).optional() });

export const Route = createFileRoute("/_authenticated/risk-analyses/new")({
  validateSearch: searchSchema,
  component: NewRiskAnalysis,
});

function NewRiskAnalysis() {
  const { mode = "manual" } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();

  // Manual creation state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [analysisType, setAnalysisType] = useState<RiskAnalysisType>("werkpost");
  const [riskMethod, setRiskMethod] = useState<RiskMethod>("fine_kinney");
  const [workpost, setWorkpost] = useState("");
  const [department, setDepartment] = useState("");
  const [saving, setSaving] = useState(false);

  // Import state
  const [parsedAnalyses, setParsedAnalyses] = useState<ParsedRiskAnalysis[]>([]);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [importType, setImportType] = useState<RiskAnalysisType>("werkpost");
  const [importMethod, setImportMethod] = useState<RiskMethod>("fine_kinney");
  const [importDept, setImportDept] = useState("");
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    try {
      const buf = await file.arrayBuffer();
      const parsed = parseMondayExport(buf);
      if (parsed.length === 0) {
        toast.error("Geen analyses gevonden in dit Excel-bestand");
        return;
      }
      setParsedAnalyses(parsed);
      setSelectedIndices(new Set(parsed.map((_, i) => i)));
      toast.success(`${parsed.length} analyse(s) gevonden`);
    } catch (e) {
      toast.error("Fout bij inlezen: " + (e instanceof Error ? e.message : "onbekende fout"));
    }
  };

  const saveManual = async () => {
    if (!title.trim()) return toast.error("Titel is verplicht");
    if (!user) return;
    setSaving(true);
    try {
      const { data: ra, error: raErr } = await supabase
        .from("risk_analyses")
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          analysis_type: analysisType,
          risk_method: riskMethod,
          workpost: workpost.trim() || null,
          department: department.trim() || null,
          status: "draft",
          current_version: 1,
          created_by: user.id,
        })
        .select("id")
        .single();
      if (raErr) throw raErr;
      const { error: vErr } = await supabase.from("risk_analysis_versions").insert({
        analysis_id: ra.id,
        version_number: 1,
        change_notes: "Initiële versie",
        created_by: user.id,
      });
      if (vErr) throw vErr;
      toast.success("Analyse aangemaakt");
      navigate({ to: "/risk-analyses/$id", params: { id: ra.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fout bij opslaan");
    } finally {
      setSaving(false);
    }
  };

  const runImport = async () => {
    if (!user) return;
    const chosen = parsedAnalyses.filter((_, i) => selectedIndices.has(i));
    if (chosen.length === 0) return toast.error("Selecteer minstens één analyse");
    setImporting(true);
    let ok = 0;
    try {
      for (const p of chosen) {
        const { data: ra, error: raErr } = await supabase
          .from("risk_analyses")
          .insert({
            title: p.title,
            analysis_type: importType,
            workpost: p.title,
            department: importDept.trim() || null,
            status: "draft",
            current_version: 1,
            created_by: user.id,
          })
          .select("id")
          .single();
        if (raErr) throw raErr;

        const { data: ver, error: vErr } = await supabase
          .from("risk_analysis_versions")
          .insert({
            analysis_id: ra.id,
            version_number: 1,
            change_notes: "Geïmporteerd uit Excel",
            created_by: user.id,
          })
          .select("id")
          .single();
        if (vErr) throw vErr;

        if (p.items.length > 0) {
          const { error: itemsErr } = await supabase.from("risk_analysis_items").insert(
            p.items.map((it) => ({
              version_id: ver.id,
              position: it.position,
              activity: it.activity,
              hazard: it.hazard,
              risk_description: it.risk_description,
              score_w: it.score_w,
              score_b: it.score_b,
              score_e: it.score_e,
              score_r: it.score_r,
              measures: it.measures,
              measure_types: it.measure_types,
              residual_w: it.residual_w,
              residual_b: it.residual_b,
              residual_e: it.residual_e,
              residual_r: it.residual_r,
            })),
          );
          if (itemsErr) throw itemsErr;
        }
        ok += 1;
      }
      toast.success(`${ok} analyse(s) geïmporteerd`);
      navigate({ to: "/risk-analyses" });
    } catch (e) {
      toast.error(`Import gestopt na ${ok} — ` + (e instanceof Error ? e.message : "fout"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/risk-analyses" })}>
        <ArrowLeft className="w-4 h-4" /> Terug naar bibliotheek
      </Button>
      <h1 className="text-2xl font-bold">Nieuwe risicoanalyse</h1>

      {mode === "import" ? (
        <>
          <Card className="p-5 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 mb-3">
              <FileSpreadsheet className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Importeer uit Excel</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Ondersteunt monday.com-exports met kolommen Activiteit, Gevarendrager, W/B/E/R, Risicoreductie en restrisico.
              Elke werkpost/functie wordt een aparte analyse.
            </p>
            <div className="grid gap-4 md:grid-cols-[1fr_auto_auto] items-end">
              <div className="space-y-2">
                <Label>Excel-bestand (.xlsx)</Label>
                <Input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                {fileName && <p className="text-xs text-muted-foreground">Bestand: {fileName}</p>}
              </div>
              <div className="space-y-2">
                <Label>Type analyse</Label>
                <Select value={importType} onValueChange={(v) => setImportType(v as RiskAnalysisType)}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABELS) as RiskAnalysisType[]).map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Afdeling (optioneel)</Label>
                <Input value={importDept} onChange={(e) => setImportDept(e.target.value)} placeholder="Bv. Petrochemie" />
              </div>
            </div>
          </Card>

          {parsedAnalyses.length > 0 && (
            <Card className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Selecteer analyses om te importeren ({selectedIndices.size}/{parsedAnalyses.length})</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIndices(new Set(parsedAnalyses.map((_, i) => i)))}>
                    Alles
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedIndices(new Set())}>
                    Geen
                  </Button>
                </div>
              </div>
              <div className="divide-y border rounded-md">
                {parsedAnalyses.map((a, i) => {
                  const selected = selectedIndices.has(i);
                  const highRisk = a.items.filter((it) => (it.score_r ?? 0) >= 200).length;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        const next = new Set(selectedIndices);
                        if (selected) next.delete(i); else next.add(i);
                        setSelectedIndices(next);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50",
                        selected && "bg-primary/5",
                      )}
                    >
                      <div className={cn(
                        "w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0",
                        selected ? "bg-primary border-primary" : "border-muted-foreground/40",
                      )}>
                        {selected && <CheckCircle2 className="w-4 h-4 text-primary-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{a.title}</div>
                        <div className="text-xs text-muted-foreground flex gap-3 mt-1">
                          <span>{a.items.length} items</span>
                          {highRisk > 0 && <span className="text-orange-600">{highRisk} met R ≥ 200</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-end pt-2">
                <Button onClick={runImport} disabled={importing || selectedIndices.size === 0}>
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importing ? "Bezig..." : `Importeer ${selectedIndices.size} analyse(s)`}
                </Button>
              </div>
            </Card>
          )}
        </>
      ) : (
        <Card className="p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Titel *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Bv. Werken op hoogte — steigerbouw" />
            </div>
            <div className="space-y-2">
              <Label>Type analyse</Label>
              <Select value={analysisType} onValueChange={(v) => setAnalysisType(v as RiskAnalysisType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(TYPE_LABELS) as RiskAnalysisType[]).map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Werkpost / functie</Label>
              <Input value={workpost} onChange={(e) => setWorkpost(e.target.value)} placeholder="Bv. Brand- en veiligheidswacht" />
            </div>
            <div className="space-y-2">
              <Label>Afdeling</Label>
              <Input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Bv. Petrochemie" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Beschrijving</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Doel en scope van de analyse" />
          </div>

          <div className="border rounded-md p-4 bg-muted/30 text-xs space-y-2">
            <div className="font-medium text-sm">Fine & Kinney classificatie (R = W × B × E)</div>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(RISK_LEVELS) as Array<keyof typeof RISK_LEVELS>).map((lvl) => {
                const v = RISK_LEVELS[lvl];
                return (
                  <Badge key={lvl} variant="outline" className={v.badgeClass}>
                    {v.label} — {v.min}{v.max === Infinity ? "+" : `–${v.max}`}
                  </Badge>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end border-t pt-4">
            <Button onClick={saveManual} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Opslaan..." : "Analyse aanmaken"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {classifyRisk(0) ? "" : ""}
            Na het aanmaken kan je items (activiteit, gevaar, W/B/E, maatregelen, restrisico) toevoegen op de detailpagina.
          </p>
        </Card>
      )}
    </div>
  );
}
