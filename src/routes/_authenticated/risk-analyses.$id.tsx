import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

import {
  ArrowLeft, Plus, Trash2, Save, Edit, Loader2, ShieldAlert, TrendingDown, FileDown, Users, Check, X,
} from "lucide-react";
import { exportRiskAnalysisToPdf } from "@/lib/risk-analysis-pdf";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  TYPE_LABELS, STATUS_LABELS, MEASURE_TYPE_META, MEASURE_TYPE_ORDER,
  METHOD_LABELS, SELECTABLE_TYPES,
  classifyRiskFor, computeRFor, levelsFor, highRiskThreshold,
  parseMeasures, serializeMeasures, measureTypesFrom,
  W_SCALE, B_SCALE, E_SCALE, K_SCALE, E5_SCALE,
  ORG_THEMES, ORG_THEME_LABELS, ORG_THEME_COLORS,
  SMILEY_META, MEASURE_STATUS_META, MEASURE_STATUS_LABELS,
  type RiskAnalysisType, type RiskAnalysisStatus, type RiskMeasureType, type RiskMethod,
  type MeasuresByType, type OrgTheme, type Smiley, type MeasureStatus,
} from "@/lib/risk-analysis-types";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/risk-analyses/$id")({
  component: RiskAnalysisDetail,
});

interface Item {
  id: string;
  position: number;
  activity: string | null;
  hazard: string;
  risk_description: string | null;
  score_w: number | null;
  score_b: number | null;
  score_e: number | null;
  score_r: number | null;
  measures: string | null;
  measure_types: RiskMeasureType[];
  residual_w: number | null;
  residual_b: number | null;
  residual_e: number | null;
  residual_r: number | null;
  // Organisatie-specifieke velden
  theme: OrgTheme | null;
  current_state: string | null;
  legislation: string | null;
  measure_status: MeasureStatus | null;
  smiley: Smiley | null;
  action_item: string | null;
  // In-memory werkveld voor de dialog: per type een tekstblok. Wordt bij
  // opslaan geserialiseerd naar `measures` (JSON) en `measure_types`.
  measures_by_type?: MeasuresByType;
  measures_legacy?: string;
}

function RiskBadge({ r, method }: { r: number | null | undefined; method: RiskMethod }) {
  const level = classifyRiskFor(method, r);
  if (r == null) return <span className="text-muted-foreground">—</span>;
  if (!level) return <span>{r}</span>;
  const cfg = levelsFor(method)[level];
  return (
    <Badge variant="outline" className={cn("font-mono text-xs", cfg.badgeClass)}>
      {r} · {cfg.label}
    </Badge>
  );
}

function RiskAnalysisDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [editItem, setEditItem] = useState<Partial<Item> | null>(null);

  const { data: analysis, isLoading } = useQuery({
    queryKey: ["risk-analysis", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risk_analyses")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: versions } = useQuery({
    queryKey: ["risk-analysis-versions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risk_analysis_versions")
        .select("*")
        .eq("analysis_id", id)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const currentVersion = useMemo(
    () => versions?.find((v) => v.version_number === analysis?.current_version) ?? versions?.[0],
    [versions, analysis?.current_version],
  );

  const { data: items } = useQuery({
    queryKey: ["risk-analysis-items", currentVersion?.id],
    enabled: !!currentVersion?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risk_analysis_items")
        .select("*")
        .eq("version_id", currentVersion!.id)
        .order("position");
      if (error) throw error;
      return data as unknown as Item[];
    },
  });

  // Alle app-gebruikers (Gebruikers & Rollen) — bron voor de uitvoerders-picker.
  const { data: appUsers } = useQuery({
    queryKey: ["profiles-picker"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_app_users");
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string | null; email: string | null }[];
    },
  });

  // Uitvoerders van deze RA, met de bijhorende gebruikersgegevens.
  const { data: executors } = useQuery({
    queryKey: ["risk-analysis-executors", id, appUsers?.length ?? 0],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risk_analysis_executors")
        .select("user_id")
        .eq("analysis_id", id);
      if (error) throw error;
      const byId = new Map((appUsers ?? []).map((u) => [u.id, u]));
      return (data ?? []).map((r) => byId.get(r.user_id) ?? { id: r.user_id, full_name: null, email: null });
    },
    enabled: !!appUsers,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["risk-analysis-items", currentVersion?.id] });
    queryClient.invalidateQueries({ queryKey: ["risk-analysis", id] });
  };

  const addExecutor = async (userId: string) => {
    const { error } = await supabase
      .from("risk_analysis_executors")
      .insert({ analysis_id: id, user_id: userId });
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["risk-analysis-executors", id] });
  };

  const removeExecutor = async (userId: string) => {
    const { error } = await supabase
      .from("risk_analysis_executors")
      .delete()
      .eq("analysis_id", id)
      .eq("user_id", userId);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["risk-analysis-executors", id] });
  };

  const method: RiskMethod = (analysis?.risk_method as RiskMethod) ?? "fine_kinney";
  const isOrg = analysis?.analysis_type === "organisatie";

  const saveItem = async () => {
    if (!editItem || !currentVersion) return;
    if (!editItem.hazard?.trim()) return toast.error(isOrg ? "Onderwerp is verplicht" : "Gevaar is verplicht");
    const payload = {
      version_id: currentVersion.id,
      position: editItem.position ?? ((items?.length ?? 0) + 1),
      activity: editItem.activity || null,
      hazard: editItem.hazard.trim(),
      risk_description: editItem.risk_description || null,
      score_w: isOrg ? null : (editItem.score_w ?? null),
      score_b: isOrg || method === "kans_ernst" ? null : (editItem.score_b ?? null),
      score_e: isOrg ? null : (editItem.score_e ?? null),
      score_r: isOrg ? null : computeRFor(method, editItem.score_w ?? null, editItem.score_b ?? null, editItem.score_e ?? null),
      measures: (() => {
        if (isOrg) {
          // Organisatie: één vrij tekstveld, geen indeling per type.
          return editItem.measures_legacy?.trim() || null;
        }
        const byType = editItem.measures_by_type ?? {};
        const serialized = serializeMeasures(byType);
        if (serialized) return serialized;
        return editItem.measures_legacy?.trim() || null;
      })(),
      measure_types: isOrg ? [] : measureTypesFrom(editItem.measures_by_type ?? {}),
      residual_w: isOrg ? null : (editItem.residual_w ?? null),
      residual_b: isOrg || method === "kans_ernst" ? null : (editItem.residual_b ?? null),
      residual_e: isOrg ? null : (editItem.residual_e ?? null),
      residual_r: isOrg ? null : computeRFor(method, editItem.residual_w ?? null, editItem.residual_b ?? null, editItem.residual_e ?? null),
      theme: isOrg ? (editItem.theme ?? null) : null,
      current_state: isOrg ? (editItem.current_state || null) : null,
      legislation: isOrg ? (editItem.legislation || null) : null,
      measure_status: isOrg ? (editItem.measure_status ?? null) : null,
      smiley: isOrg ? (editItem.smiley ?? null) : null,
      action_item: isOrg ? (editItem.action_item || null) : null,
    };
    try {
      if (editItem.id) {
        const { error } = await supabase.from("risk_analysis_items").update(payload).eq("id", editItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("risk_analysis_items").insert(payload);
        if (error) throw error;
      }
      toast.success("Item opgeslagen");
      setEditItem(null);
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fout bij opslaan");
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!confirm("Item verwijderen?")) return;
    const { error } = await supabase.from("risk_analysis_items").delete().eq("id", itemId);
    if (error) toast.error(error.message);
    else invalidate();
  };

  const updateStatus = async (status: RiskAnalysisStatus) => {
    const { error } = await supabase.from("risk_analyses").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    if (status === "published" && currentVersion && !currentVersion.published_at) {
      await supabase.from("risk_analysis_versions").update({ published_at: new Date().toISOString() }).eq("id", currentVersion.id);
    }
    toast.success("Status bijgewerkt");
    invalidate();
  };

  const updateType = async (analysis_type: RiskAnalysisType) => {
    const { error } = await supabase.from("risk_analyses").update({ analysis_type }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Type bijgewerkt");
    invalidate();
  };

  const createNewVersion = async () => {
    if (!user || !analysis || !currentVersion) return;
    const notes = prompt("Wijzignotitie voor de nieuwe versie:");
    if (notes === null) return;
    try {
      const nextNumber = (analysis.current_version ?? 1) + 1;
      const { data: newVer, error: vErr } = await supabase
        .from("risk_analysis_versions")
        .insert({
          analysis_id: id,
          version_number: nextNumber,
          change_notes: notes || "Nieuwe versie",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (vErr) throw vErr;
      // Copy items
      if (items && items.length > 0) {
        const { error: cErr } = await supabase.from("risk_analysis_items").insert(
          items.map((it) => ({
            version_id: newVer.id,
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
            theme: it.theme,
            current_state: it.current_state,
            legislation: it.legislation,
            measure_status: it.measure_status,
            smiley: it.smiley,
            action_item: it.action_item,
          })),
        );
        if (cErr) throw cErr;
      }
      await supabase.from("risk_analyses").update({ current_version: nextNumber }).eq("id", id);
      toast.success(`Versie ${nextNumber} aangemaakt`);
      queryClient.invalidateQueries({ queryKey: ["risk-analysis-versions", id] });
      invalidate();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fout");
    }
  };

  const stats = useMemo(() => {
    if (!items) return null;
    const threshold = highRiskThreshold(method);
    const grossHigh = items.filter((i) => (i.score_r ?? 0) >= threshold).length;
    const netHigh = items.filter((i) => (i.residual_r ?? 0) >= threshold).length;
    const avgReduction = items.length
      ? Math.round(
          items.reduce((sum, i) => {
            if (i.score_r && i.residual_r) return sum + ((i.score_r - i.residual_r) / i.score_r) * 100;
            return sum;
          }, 0) / items.length,
        )
      : 0;
    return { total: items.length, grossHigh, netHigh, avgReduction, threshold };
  }, [items, method]);

  if (isLoading || !analysis) {
    return <div className="text-sm text-muted-foreground">Laden...</div>;
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/risk-analyses" })}>
        <ArrowLeft className="w-4 h-4" /> Terug naar bibliotheek
      </Button>

      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline">{TYPE_LABELS[analysis.analysis_type as RiskAnalysisType]}</Badge>
            <Badge variant={analysis.status === "published" ? "default" : "secondary"}>
              {STATUS_LABELS[analysis.status as RiskAnalysisStatus]}
            </Badge>
            <Badge variant="outline">Versie {analysis.current_version}</Badge>
            <Badge variant="outline" className="text-[10px]">{METHOD_LABELS[method]}</Badge>
          </div>
          <h1 className="text-2xl font-bold">{analysis.title}</h1>
          <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-3">
            {analysis.workpost && <span>Werkpost: {analysis.workpost}</span>}
            {analysis.department && <span>Afdeling: {analysis.department}</span>}
          </div>
          {analysis.description && <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{analysis.description}</p>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={analysis.analysis_type} onValueChange={(v) => updateType(v as RiskAnalysisType)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SELECTABLE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
              ))}
              {/* Toon huidig type ook als het uitgefaseerd is, zodat de selectie zichtbaar blijft. */}
              {!SELECTABLE_TYPES.includes(analysis.analysis_type as RiskAnalysisType) && (
                <SelectItem value={analysis.analysis_type}>
                  {TYPE_LABELS[analysis.analysis_type as RiskAnalysisType] ?? analysis.analysis_type} — wijzig aub
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          <Select value={analysis.status} onValueChange={(v) => updateStatus(v as RiskAnalysisStatus)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Concept</SelectItem>
              <SelectItem value="published">Gepubliceerd</SelectItem>
              <SelectItem value="archived">Gearchiveerd</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() =>
              exportRiskAnalysisToPdf({
                id: analysis.id,
                title: analysis.title,
                description: analysis.description,
                analysis_type: analysis.analysis_type as RiskAnalysisType,
                status: analysis.status as RiskAnalysisStatus,
                workpost: analysis.workpost,
                department: analysis.department,
                risk_method: method,
                current_version: analysis.current_version,
                version_change_notes: currentVersion?.change_notes,
                version_published_at: currentVersion?.published_at,
                executors: executors ?? [],
                items: items ?? [],
              }).catch((e) => toast.error(e instanceof Error ? e.message : "Export mislukt"))
            }
          >
            <FileDown className="w-4 h-4" /> Exporteer PDF
          </Button>
          <Button variant="outline" onClick={createNewVersion}>
            <Plus className="w-4 h-4" /> Nieuwe versie
          </Button>
        </div>
      </div>

      {stats && (
        <div className="grid gap-3 md:grid-cols-4">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Totaal items</div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Bruto R ≥ {stats.threshold}</div>
            <div className="text-2xl font-bold mt-1 text-orange-600">{stats.grossHigh}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Netto R ≥ {stats.threshold}</div>
            <div className={cn("text-2xl font-bold mt-1", stats.netHigh > 0 ? "text-orange-600" : "text-green-600")}>
              {stats.netHigh}
            </div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide flex items-center gap-1">
              <TrendingDown className="w-3 h-3" /> Gem. reductie
            </div>
            <div className="text-2xl font-bold mt-1 text-green-600">{stats.avgReduction}%</div>
          </Card>
        </div>
      )}

      <ExecutorsCard
        users={appUsers ?? []}
        executors={executors ?? []}
        onAdd={addExecutor}
        onRemove={removeExecutor}
      />


      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Items ({items?.length ?? 0})</h2>
          <Button size="sm" onClick={() => setEditItem({
            position: (items?.length ?? 0) + 1,
            measure_types: [],
            measures_by_type: {},
            ...(isOrg ? { theme: "ALG" as OrgTheme, smiley: "green" as Smiley, measure_status: "open" as MeasureStatus } : {}),
          })}>
            <Plus className="w-4 h-4" /> Item toevoegen
          </Button>
        </div>

        {!items || items.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            <ShieldAlert className="w-10 h-10 mx-auto mb-2 opacity-40" />
            Nog geen items in deze versie.
          </div>
        ) : isOrg ? (
          <OrgAccordion
            items={items}
            onEdit={(it) => {
              const parsed = parseMeasures(it.measures);
              setEditItem({ ...it, measures_by_type: parsed.byType, measures_legacy: parsed.legacy });
            }}
            onDelete={deleteItem}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase border-b">
                <tr>
                  <th className="text-left py-2 px-2 w-10">#</th>
                  <th className="text-left py-2 px-2">Activiteit / Gevaar</th>
                  <th className="text-left py-2 px-2 w-32">Bruto risico</th>
                  <th className="text-left py-2 px-2">Maatregelen</th>
                  <th className="text-left py-2 px-2 w-32">Netto risico</th>
                  <th className="w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-muted/30">
                    <td className="py-3 px-2 text-muted-foreground font-mono text-xs">{it.position}</td>
                    <td className="py-3 px-2">
                      {it.activity && <div className="text-xs text-muted-foreground">{it.activity}</div>}
                      <div className="font-medium">{it.hazard}</div>
                      {it.risk_description && (
                        <div className="text-xs text-muted-foreground italic mt-0.5">Kans op: {it.risk_description}</div>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <RiskBadge r={it.score_r} method={method} />
                      <div className="text-[10px] text-muted-foreground font-mono mt-1">
                        {method === "kans_ernst"
                          ? <>K{it.score_w ?? "—"} · E{it.score_e ?? "—"}</>
                          : <>W{it.score_w ?? "—"} · B{it.score_b ?? "—"} · E{it.score_e ?? "—"}</>}
                      </div>
                    </td>
                    <td className="py-3 px-2 max-w-md">
                      <MeasuresCell raw={it.measures} />
                    </td>
                    <td className="py-3 px-2">
                      <RiskBadge r={it.residual_r} method={method} />
                      {it.residual_w != null && (
                        <div className="text-[10px] text-muted-foreground font-mono mt-1">
                          {method === "kans_ernst"
                            ? <>K{it.residual_w} · E{it.residual_e}</>
                            : <>W{it.residual_w} · B{it.residual_b} · E{it.residual_e}</>}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => {
                          const parsed = parseMeasures(it.measures);
                          setEditItem({ ...it, measures_by_type: parsed.byType, measures_legacy: parsed.legacy });
                        }}>

                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteItem(it.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ItemDialog
        item={editItem}
        method={method}
        isOrg={isOrg}
        onClose={() => setEditItem(null)}
        onChange={setEditItem}
        onSave={saveItem}
      />
    </div>
  );
}

function ScoreSelect({
  value, onChange, scale, placeholder,
}: { value: number | null | undefined; onChange: (v: number | null) => void; scale: { value: number; label: string }[]; placeholder: string }) {
  return (
    <Select
      value={value == null ? "" : String(value)}
      onValueChange={(v) => onChange(v === "" ? null : Number(v))}
    >
      <SelectTrigger className="text-xs"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {scale.map((s) => (
          <SelectItem key={s.value} value={String(s.value)} className="text-xs">{s.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ItemDialog({
  item, method, isOrg, onClose, onChange, onSave,
}: {
  item: Partial<Item> | null;
  method: RiskMethod;
  isOrg: boolean;
  onClose: () => void;
  onChange: (i: Partial<Item>) => void;
  onSave: () => void;
}) {
  if (!item) return null;
  if (isOrg) {
    return <OrgItemDialog item={item} onClose={onClose} onChange={onChange} onSave={onSave} />;
  }
  const isKE = method === "kans_ernst";
  const grossR = computeRFor(method, item.score_w ?? null, item.score_b ?? null, item.score_e ?? null);
  const netR = computeRFor(method, item.residual_w ?? null, item.residual_b ?? null, item.residual_e ?? null);
  const kansScale = isKE ? K_SCALE : W_SCALE;
  const ernstScale = isKE ? E5_SCALE : E_SCALE;
  const kansLabel = isKE ? "K · Kans" : "W · Waarschijnlijkheid";
  const ernstLabel = isKE ? "E · Ernst" : "E · Effect";

  const byType: MeasuresByType = item.measures_by_type ?? {};
  const setByType = (t: RiskMeasureType, v: string) => {
    const next = { ...byType, [t]: v };
    onChange({ ...item, measures_by_type: next });
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.id ? "Item bewerken" : "Nieuw item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Activiteit</Label>
              <Input value={item.activity ?? ""} onChange={(e) => onChange({ ...item, activity: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Risico (Kans op...)</Label>
              <Input value={item.risk_description ?? ""} onChange={(e) => onChange({ ...item, risk_description: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Gevarendrager / gevaar *</Label>
            <Input value={item.hazard ?? ""} onChange={(e) => onChange({ ...item, hazard: e.target.value })} />
          </div>

          <div className="border rounded-md p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">Bruto risico (zonder maatregelen)</div>
              <RiskBadge r={grossR} method={method} />
            </div>
            <div className={cn("grid gap-2", isKE ? "md:grid-cols-2" : "md:grid-cols-3")}>
              <div><Label className="text-[10px] uppercase">{kansLabel}</Label>
                <ScoreSelect value={item.score_w} onChange={(v) => onChange({ ...item, score_w: v })} scale={kansScale} placeholder={isKE ? "K" : "W"} />
              </div>
              {!isKE && (
                <div><Label className="text-[10px] uppercase">B · Blootstelling</Label>
                  <ScoreSelect value={item.score_b} onChange={(v) => onChange({ ...item, score_b: v })} scale={B_SCALE} placeholder="B" />
                </div>
              )}
              <div><Label className="text-[10px] uppercase">{ernstLabel}</Label>
                <ScoreSelect value={item.score_e} onChange={(v) => onChange({ ...item, score_e: v })} scale={ernstScale} placeholder="E" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <Label className="text-xs">Risicoreductie — per type maatregel</Label>
              <span className="text-[10px] text-muted-foreground">
                Volgorde: technisch (bron) → organisatorisch → mensgericht (PBM)
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {MEASURE_TYPE_ORDER.map((t) => {
                const meta = MEASURE_TYPE_META[t];
                return (
                  <div key={t} className="border rounded-md overflow-hidden">
                    <div
                      className="px-3 py-2 text-xs font-semibold flex items-center gap-2 border-b"
                      style={{ background: meta.swatch + "18", color: meta.swatch }}
                    >
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white"
                        style={{ background: meta.swatch }}
                      >
                        {meta.short}
                      </span>
                      {meta.label}
                    </div>
                    <Textarea
                      rows={5}
                      className="border-0 rounded-none focus-visible:ring-0 text-sm"
                      placeholder={meta.hint}
                      value={byType[t] ?? ""}
                      onChange={(e) => setByType(t, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
            {item.measures_legacy && (
              <div className="border rounded-md p-3 bg-yellow-50 border-yellow-200 text-xs space-y-1">
                <div className="font-semibold text-yellow-900">
                  Bestaande omschrijving (nog niet ingedeeld per type)
                </div>
                <div className="whitespace-pre-line text-yellow-900/80">{item.measures_legacy}</div>
                <div className="text-[10px] text-yellow-800">
                  Kopieer de tekst in de juiste kolom(men) hierboven en sla op — dan verdwijnt dit blok.
                </div>
              </div>
            )}
          </div>

          <div className="border rounded-md p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">Restrisico (na maatregelen)</div>
              <RiskBadge r={netR} method={method} />
            </div>
            <div className={cn("grid gap-2", isKE ? "md:grid-cols-2" : "md:grid-cols-3")}>
              <div><Label className="text-[10px] uppercase">{isKE ? "K′" : "W′"}</Label>
                <ScoreSelect value={item.residual_w} onChange={(v) => onChange({ ...item, residual_w: v })} scale={kansScale} placeholder={isKE ? "K" : "W"} />
              </div>
              {!isKE && (
                <div><Label className="text-[10px] uppercase">B′</Label>
                  <ScoreSelect value={item.residual_b} onChange={(v) => onChange({ ...item, residual_b: v })} scale={B_SCALE} placeholder="B" />
                </div>
              )}
              <div><Label className="text-[10px] uppercase">E′</Label>
                <ScoreSelect value={item.residual_e} onChange={(v) => onChange({ ...item, residual_e: v })} scale={ernstScale} placeholder="E" />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuleer</Button>
          <Button onClick={onSave}><Save className="w-4 h-4" /> Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Toont per item de risicoreductie ingedeeld per type maatregel.
// Wanneer een item nog niet is gemigreerd (vrije tekst) valt het terug op een neutrale weergave.
function MeasuresCell({ raw }: { raw: string | null }) {
  const { byType, legacy } = parseMeasures(raw);
  const activeTypes = MEASURE_TYPE_ORDER.filter((t) => (byType[t] ?? "").trim().length > 0);
  if (activeTypes.length === 0 && !legacy) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="space-y-1.5">
      {activeTypes.map((t) => {
        const meta = MEASURE_TYPE_META[t];
        return (
          <div key={t} className="text-xs">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span
                className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white"
                style={{ background: meta.swatch }}
                title={meta.label}
              >
                {meta.short}
              </span>
              <span className="font-medium" style={{ color: meta.swatch }}>{meta.label}</span>
            </div>
            <div className="whitespace-pre-line line-clamp-3 pl-5 text-muted-foreground">
              {byType[t]}
            </div>
          </div>
        );
      })}
      {legacy && (
        <div className="text-xs">
          <Badge variant="outline" className="text-[9px] py-0 mb-0.5">Niet ingedeeld</Badge>
          <div className="whitespace-pre-line line-clamp-3 text-muted-foreground">{legacy}</div>
        </div>
      )}
    </div>
  );
}

type ExecutorUser = { id: string; full_name: string | null; email: string | null };

function ExecutorsCard({
  users, executors, onAdd, onRemove,
}: {
  users: ExecutorUser[];
  executors: ExecutorUser[];
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedIds = new Set(executors.map((e) => e.id));
  const displayName = (u: ExecutorUser) => u.full_name || u.email || "Onbekende gebruiker";
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold flex items-center gap-2">
            <Users className="w-4 h-4" /> Uitvoerders
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kies uit de vaste lijst van app-gebruikers (Gebruikers &amp; Rollen). Verschijnen ook op de export.
          </p>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="w-4 h-4" /> Uitvoerder toevoegen
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <Command
              filter={(v, s) => (v.toLowerCase().includes(s.toLowerCase()) ? 1 : 0)}
            >
              <CommandInput placeholder="Zoek op naam of e-mail…" />
              <CommandList>
                <CommandEmpty>Geen gebruikers gevonden.</CommandEmpty>
                <CommandGroup>
                  {users.map((u) => {
                    const active = selectedIds.has(u.id);
                    return (
                      <CommandItem
                        key={u.id}
                        value={`${u.full_name ?? ""} ${u.email ?? ""}`}
                        onSelect={() => {
                          if (active) onRemove(u.id);
                          else onAdd(u.id);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", active ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col">
                          <span className="text-sm">{displayName(u)}</span>
                          {u.email && u.full_name && (
                            <span className="text-[10px] text-muted-foreground">{u.email}</span>
                          )}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      {executors.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">Nog geen uitvoerders toegewezen.</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {executors.map((u) => (
            <Badge key={u.id} variant="secondary" className="gap-1.5 pr-1 py-1">
              <span className="text-xs">{displayName(u)}</span>
              <button
                type="button"
                onClick={() => onRemove(u.id)}
                className="rounded-full hover:bg-muted p-0.5"
                aria-label="Verwijder uitvoerder"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </Card>
  );
}

// ============ Organisatie-analyse — accordion per thema ============
function OrgAccordion({
  items, onEdit, onDelete,
}: {
  items: Item[];
  onEdit: (it: Item) => void;
  onDelete: (id: string) => void;
}) {
  const grouped = new Map<OrgTheme, Item[]>();
  const untagged: Item[] = [];
  for (const it of items) {
    const t = it.theme;
    if (t && ORG_THEMES.includes(t)) {
      if (!grouped.has(t)) grouped.set(t, []);
      grouped.get(t)!.push(it);
    } else {
      untagged.push(it);
    }
  }
  const themes = ORG_THEMES.filter((t) => grouped.has(t));

  return (
    <Accordion type="multiple" defaultValue={themes} className="w-full">
      {themes.map((t) => {
        const list = grouped.get(t)!;
        const color = ORG_THEME_COLORS[t];
        return (
          <AccordionItem key={t} value={t}>
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-3">
                <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                <span className="font-semibold">{t} — {ORG_THEME_LABELS[t]}</span>
                <Badge variant="outline" className="text-[10px]">{list.length}</Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <OrgItemsTable items={list} onEdit={onEdit} onDelete={onDelete} />
            </AccordionContent>
          </AccordionItem>
        );
      })}
      {untagged.length > 0 && (
        <AccordionItem value="__untagged">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-400" />
              <span className="font-semibold">Zonder thema</span>
              <Badge variant="outline" className="text-[10px]">{untagged.length}</Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <OrgItemsTable items={untagged} onEdit={onEdit} onDelete={onDelete} />
          </AccordionContent>
        </AccordionItem>
      )}
    </Accordion>
  );
}

function OrgItemsTable({
  items, onEdit, onDelete,
}: {
  items: Item[];
  onEdit: (it: Item) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground uppercase border-b">
          <tr>
            <th className="text-left py-2 px-2 w-16">Score</th>
            <th className="text-left py-2 px-2">Onderwerp</th>
            <th className="text-left py-2 px-2">Huidige toestand</th>
            <th className="text-left py-2 px-2">Maatregelen</th>
            <th className="text-left py-2 px-2 w-40">Wetgeving</th>
            <th className="text-left py-2 px-2 w-32">Status</th>
            <th className="w-20"></th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((it) => {
            const smiley = it.smiley ? SMILEY_META[it.smiley] : null;
            const status = it.measure_status ? MEASURE_STATUS_META[it.measure_status] : null;
            return (
              <tr key={it.id} className="hover:bg-muted/30 align-top">
                <td className="py-3 px-2">
                  {smiley ? (
                    <span
                      title={smiley.label}
                      className={cn("inline-flex items-center justify-center w-9 h-9 rounded-full text-lg border", smiley.badgeClass)}
                    >
                      {smiley.emoji}
                    </span>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="py-3 px-2">
                  <div className="font-medium">{it.hazard}</div>
                  {it.risk_description && (
                    <div className="text-xs text-muted-foreground italic mt-0.5">{it.risk_description}</div>
                  )}
                </td>
                <td className="py-3 px-2 max-w-xs">
                  <div className="text-xs whitespace-pre-line">{it.current_state || <span className="text-muted-foreground">—</span>}</div>
                </td>
                <td className="py-3 px-2 max-w-md">
                  <MeasuresCell raw={it.measures} />
                </td>
                <td className="py-3 px-2">
                  <div className="text-xs whitespace-pre-line">{it.legislation || <span className="text-muted-foreground">—</span>}</div>
                </td>
                <td className="py-3 px-2">
                  {status ? (
                    <Badge variant="outline" className={cn("text-[10px]", status.badgeClass)}>{status.label}</Badge>
                  ) : <span className="text-xs text-muted-foreground">—</span>}
                </td>
                <td className="py-3 px-2">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => onEdit(it)}>
                      <Edit className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => onDelete(it.id)}>
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrgItemDialog({
  item, onClose, onChange, onSave,
}: {
  item: Partial<Item>;
  onClose: () => void;
  onChange: (i: Partial<Item>) => void;
  onSave: () => void;
}) {
  const byType: MeasuresByType = item.measures_by_type ?? {};
  const setByType = (t: RiskMeasureType, v: string) => {
    onChange({ ...item, measures_by_type: { ...byType, [t]: v } });
  };
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.id ? "Item bewerken" : "Nieuw item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Thema</Label>
              <Select
                value={item.theme ?? "ALG"}
                onValueChange={(v) => onChange({ ...item, theme: v as OrgTheme })}
              >
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORG_THEMES.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {t} — {ORG_THEME_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Beoordeling</Label>
              <Select
                value={item.smiley ?? "green"}
                onValueChange={(v) => onChange({ ...item, smiley: v as Smiley })}
              >
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["green", "yellow", "red"] as Smiley[]).map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {SMILEY_META[s].emoji} {SMILEY_META[s].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Status maatregel</Label>
              <Select
                value={item.measure_status ?? "open"}
                onValueChange={(v) => onChange({ ...item, measure_status: v as MeasureStatus })}
              >
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(MEASURE_STATUS_LABELS) as MeasureStatus[]).map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">{MEASURE_STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Onderwerp *</Label>
            <Input value={item.hazard ?? ""} onChange={(e) => onChange({ ...item, hazard: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Toelichting / risico</Label>
            <Textarea rows={2} value={item.risk_description ?? ""} onChange={(e) => onChange({ ...item, risk_description: e.target.value })} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Huidige toestand</Label>
            <Textarea rows={3} value={item.current_state ?? ""} onChange={(e) => onChange({ ...item, current_state: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Maatregelen — per type</Label>
            <div className="grid gap-3 md:grid-cols-3">
              {MEASURE_TYPE_ORDER.map((t) => {
                const meta = MEASURE_TYPE_META[t];
                return (
                  <div key={t} className="border rounded-md overflow-hidden">
                    <div
                      className="px-3 py-2 text-xs font-semibold flex items-center gap-2 border-b"
                      style={{ background: meta.swatch + "18", color: meta.swatch }}
                    >
                      <span
                        className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold text-white"
                        style={{ background: meta.swatch }}
                      >
                        {meta.short}
                      </span>
                      {meta.label}
                    </div>
                    <Textarea
                      rows={4}
                      className="border-0 rounded-none focus-visible:ring-0 text-sm"
                      placeholder={meta.hint}
                      value={byType[t] ?? ""}
                      onChange={(e) => setByType(t, e.target.value)}
                    />
                  </div>
                );
              })}
            </div>
            {item.measures_legacy && (
              <div className="border rounded-md p-3 bg-yellow-50 border-yellow-200 text-xs space-y-1">
                <div className="font-semibold text-yellow-900">Bestaande omschrijving (nog niet ingedeeld per type)</div>
                <div className="whitespace-pre-line text-yellow-900/80">{item.measures_legacy}</div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Wetgeving / referentie</Label>
            <Textarea rows={2} value={item.legislation ?? ""} onChange={(e) => onChange({ ...item, legislation: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annuleer</Button>
          <Button onClick={onSave}><Save className="w-4 h-4" /> Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
