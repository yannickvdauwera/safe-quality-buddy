import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { ShieldAlert, Plus, Search, FileDown, Loader2, ChevronDown, ChevronRight, HelpCircle } from "lucide-react";
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
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button onClick={() => navigate({ to: "/risk-analyses/new", search: { mode: "manual" } })}>
            <Plus className="w-4 h-4" /> Nieuwe analyse
          </Button>
          <HoverCard openDelay={200} closeDelay={100}>
            <HoverCardTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-foreground">
                <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
                Toelichting analysemethode
              </Button>
            </HoverCardTrigger>
            <HoverCardContent align="end" className="w-80 p-0 overflow-hidden">
              <MethodExplanation />
            </HoverCardContent>
          </HoverCard>
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
        <KanbanBoard
          columns={columns}
          exportingId={exportingId}
          onExport={handleExport}
        />
      )}
    </div>
  );
}

function KanbanBoard({
  columns,
  exportingId,
  onExport,
}: {
  columns: Record<string, AnalysisRow[]>;
  exportingId: string | null;
  onExport: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const toggle = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  const allKeys: { key: string; title: string; muted?: boolean }[] = [
    ...SELECTABLE_TYPES.map((t) => ({ key: t, title: TYPE_LABELS[t] })),
  ];
  if (columns[OTHER_KEY]?.length > 0) {
    allKeys.push({ key: OTHER_KEY, title: "Overig (verouderd — wijzig type)", muted: true });
  }

  const openCols = allKeys.filter((c) => !collapsed[c.key]);
  const collapsedCols = allKeys.filter((c) => collapsed[c.key]);

  return (
    <div className="space-y-3">
      {collapsedCols.length > 0 && (
        <div className="flex flex-col gap-2">
          {collapsedCols.map((c) => (
            <CollapsedBar
              key={c.key}
              title={c.title}
              count={columns[c.key].length}
              muted={c.muted}
              onExpand={() => toggle(c.key)}
            />
          ))}
        </div>
      )}
      {openCols.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {openCols.map((c) => (
            <KanbanColumn
              key={c.key}
              title={c.title}
              items={columns[c.key]}
              exportingId={exportingId}
              onExport={onExport}
              muted={c.muted}
              onCollapse={() => toggle(c.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CollapsedBar({
  title, count, muted, onExpand,
}: { title: string; count: number; muted?: boolean; onExpand: () => void }) {
  return (
    <button
      type="button"
      onClick={onExpand}
      className={`w-full flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-left hover:bg-muted/50 transition-colors ${muted ? "opacity-90" : ""}`}
    >
      <div className="flex items-center gap-1.5">
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
      </div>
      <Badge variant="secondary" className="text-[10px]">{count}</Badge>
    </button>
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
  onCollapse,
}: {
  title: string;
  items: AnalysisRow[];
  exportingId: string | null;
  onExport: (id: string) => void;
  muted?: boolean;
  onCollapse: () => void;
}) {
  const navigate = useNavigate();
  return (
    <div className={`rounded-lg border bg-muted/30 p-3 flex flex-col gap-3 ${muted ? "opacity-90" : ""}`}>
      <button
        type="button"
        onClick={onCollapse}
        className="flex items-center justify-between px-1 w-full text-left hover:opacity-80"
        aria-expanded={true}
      >
        <div className="flex items-center gap-1.5">
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
        </div>
        <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
      </button>
      {items.length === 0 ? (
        <div className="text-xs text-muted-foreground italic px-1 py-6 text-center">
          Geen analyses in deze kolom.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((a) => (
            <Card
              key={a.id}
              className="p-3 hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
              onClick={() => navigate({ to: "/risk-analyses/$id", params: { id: a.id } })}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-semibold leading-tight flex-1 text-sm">{a.title}</h3>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant={a.status === "published" ? "default" : "secondary"} className="text-[10px]">
                    {STATUS_LABELS[a.status as RiskAnalysisStatus] ?? a.status}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 -mr-1"
                    title="Exporteer PDF"
                    disabled={exportingId === a.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onExport(a.id);
                    }}
                  >
                    {exportingId === a.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <FileDown className="w-3.5 h-3.5" />}
                  </Button>
                </div>
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
          ))}
        </div>
      )}
    </div>
  );
}

