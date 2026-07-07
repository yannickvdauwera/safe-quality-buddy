import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ShieldAlert, Plus, Search, FileDown, Loader2 } from "lucide-react";
import {
  STATUS_LABELS, TYPE_LABELS, SELECTABLE_TYPES,
  type RiskAnalysisType, type RiskAnalysisStatus, type RiskMethod,
} from "@/lib/risk-analysis-types";
import { exportRiskAnalysisToPdf } from "@/lib/risk-analysis-pdf";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/risk-analyses/")({
  component: RiskAnalysesLibrary,
});

// Kanban-kolommen: één per actief type, plus een "Overig" kolom voor legacy records
// (lmra/rie) die nog niet zijn overgezet naar een actief type.
const OTHER_KEY = "__other__";

function RiskAnalysesLibrary() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [exportingId, setExportingId] = useState<string | null>(null);

  const { data: analyses, isLoading } = useQuery({
    queryKey: ["risk-analyses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risk_analyses")
        .select("id, title, description, analysis_type, workpost, department, status, current_version, updated_at, risk_method")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(
    () =>
      (analyses ?? []).filter((a) => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (
          a.title.toLowerCase().includes(q) ||
          (a.workpost ?? "").toLowerCase().includes(q) ||
          (a.department ?? "").toLowerCase().includes(q)
        );
      }),
    [analyses, search],
  );

  // Groepeer per type; legacy types belanden in "Overig" zodat ze omgezet kunnen worden.
  const columns = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    for (const t of SELECTABLE_TYPES) groups[t] = [];
    groups[OTHER_KEY] = [];
    for (const a of filtered) {
      const key = SELECTABLE_TYPES.includes(a.analysis_type as RiskAnalysisType)
        ? a.analysis_type
        : OTHER_KEY;
      groups[key].push(a);
    }
    return groups;
  }, [filtered]);

  const handleExport = async (analysisId: string) => {
    setExportingId(analysisId);
    try {
      const { data: a, error: aErr } = await supabase
        .from("risk_analyses")
        .select("*")
        .eq("id", analysisId)
        .single();
      if (aErr) throw aErr;
      const { data: ver, error: vErr } = await supabase
        .from("risk_analysis_versions")
        .select("*")
        .eq("analysis_id", analysisId)
        .eq("version_number", a.current_version)
        .maybeSingle();
      if (vErr) throw vErr;
      let items: unknown[] = [];
      if (ver) {
        const { data: its, error: iErr } = await supabase
          .from("risk_analysis_items")
          .select("*")
          .eq("version_id", ver.id)
          .order("position");
        if (iErr) throw iErr;
        items = its ?? [];
      }
      await exportRiskAnalysisToPdf({
        id: a.id,
        title: a.title,
        description: a.description,
        analysis_type: a.analysis_type as RiskAnalysisType,
        status: a.status as RiskAnalysisStatus,
        workpost: a.workpost,
        department: a.department,
        risk_method: (a.risk_method as RiskMethod) ?? "kans_ernst",
        current_version: a.current_version,
        version_change_notes: ver?.change_notes,
        version_published_at: ver?.published_at,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        items: items as any,
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export mislukt");
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Risicoanalyses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Werkpostanalyses en TRA's volgens de Kans × Ernst matrix (5 × 5).
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate({ to: "/risk-analyses/new", search: { mode: "manual" } })}>
            <Plus className="w-4 h-4" /> Nieuwe analyse
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Zoek op titel, werkpost of afdeling..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Laden...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <ShieldAlert className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {analyses && analyses.length > 0
              ? "Geen analyses gevonden voor deze zoekopdracht."
              : "Nog geen risicoanalyses. Maak er één aan of importeer uit Excel."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {SELECTABLE_TYPES.map((t) => (
            <KanbanColumn
              key={t}
              title={TYPE_LABELS[t]}
              items={columns[t]}
              exportingId={exportingId}
              onExport={handleExport}
            />
          ))}
          {columns[OTHER_KEY].length > 0 && (
            <KanbanColumn
              key={OTHER_KEY}
              title="Overig (verouderd — wijzig type)"
              items={columns[OTHER_KEY]}
              exportingId={exportingId}
              onExport={handleExport}
              muted
            />
          )}
        </div>
      )}
    </div>
  );
}

type AnalysisRow = {
  id: string;
  title: string;
  description: string | null;
  analysis_type: string;
  workpost: string | null;
  department: string | null;
  status: string;
  current_version: number;
  updated_at: string;
};

function KanbanColumn({
  title,
  items,
  exportingId,
  onExport,
  muted,
}: {
  title: string;
  items: AnalysisRow[];
  exportingId: string | null;
  onExport: (id: string) => void;
  muted?: boolean;
}) {
  return (
    <div className={`rounded-lg border bg-muted/30 p-3 flex flex-col gap-3 ${muted ? "opacity-90" : ""}`}>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground italic px-1 py-6 text-center">
          Geen analyses in deze kolom.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((a) => (
            <div key={a.id} className="relative group">
              <Link to="/risk-analyses/$id" params={{ id: a.id }} className="block">
                <Card className="p-3 hover:border-primary/50 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold leading-tight flex-1 text-sm pr-16">{a.title}</h3>
                    <Badge variant={a.status === "published" ? "default" : "secondary"} className="text-[10px]">
                      {STATUS_LABELS[a.status as RiskAnalysisStatus] ?? a.status}
                    </Badge>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {a.workpost && <Badge variant="outline" className="text-[10px]">{a.workpost}</Badge>}
                    {a.department && <Badge variant="outline" className="text-[10px]">{a.department}</Badge>}
                  </div>
                  {a.description && <p className="text-xs text-muted-foreground line-clamp-2">{a.description}</p>}
                  <div className="text-[10px] text-muted-foreground mt-2 pt-2 border-t">
                    v{a.current_version} · {new Date(a.updated_at).toLocaleDateString("nl-BE")}
                  </div>
                </Card>
              </Link>
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-2 right-14 h-7 w-7 opacity-70 group-hover:opacity-100"
                title="Exporteer PDF"
                disabled={exportingId === a.id}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onExport(a.id);
                }}
              >
                {exportingId === a.id
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <FileDown className="w-3.5 h-3.5" />}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
