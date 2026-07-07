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
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft, Plus, Trash2, Save, Edit, Loader2, ShieldAlert, TrendingDown,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  TYPE_LABELS, STATUS_LABELS, MEASURE_TYPE_LABELS, METHOD_LABELS,
  RISK_LEVELS, RISK_LEVELS_KE, classifyRiskFor, computeRFor, levelsFor, highRiskThreshold,
  W_SCALE, B_SCALE, E_SCALE, K_SCALE, E5_SCALE,
  type RiskAnalysisType, type RiskAnalysisStatus, type RiskMeasureType, type RiskMethod,
} from "@/lib/risk-analysis-types";
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

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["risk-analysis-items", currentVersion?.id] });
    queryClient.invalidateQueries({ queryKey: ["risk-analysis", id] });
  };

  const method: RiskMethod = (analysis?.risk_method as RiskMethod) ?? "fine_kinney";

  const saveItem = async () => {
    if (!editItem || !currentVersion) return;
    if (!editItem.hazard?.trim()) return toast.error("Gevaar is verplicht");
    const payload = {
      version_id: currentVersion.id,
      position: editItem.position ?? ((items?.length ?? 0) + 1),
      activity: editItem.activity || null,
      hazard: editItem.hazard.trim(),
      risk_description: editItem.risk_description || null,
      score_w: editItem.score_w ?? null,
      score_b: method === "kans_ernst" ? null : (editItem.score_b ?? null),
      score_e: editItem.score_e ?? null,
      score_r: computeRFor(method, editItem.score_w ?? null, editItem.score_b ?? null, editItem.score_e ?? null),
      measures: editItem.measures || null,
      measure_types: editItem.measure_types ?? [],
      residual_w: editItem.residual_w ?? null,
      residual_b: method === "kans_ernst" ? null : (editItem.residual_b ?? null),
      residual_e: editItem.residual_e ?? null,
      residual_r: computeRFor(method, editItem.residual_w ?? null, editItem.residual_b ?? null, editItem.residual_e ?? null),
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
          </div>
          <h1 className="text-2xl font-bold">{analysis.title}</h1>
          <div className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-3">
            {analysis.workpost && <span>Werkpost: {analysis.workpost}</span>}
            {analysis.department && <span>Afdeling: {analysis.department}</span>}
          </div>
          {analysis.description && <p className="text-sm text-muted-foreground mt-2 max-w-2xl">{analysis.description}</p>}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={analysis.status} onValueChange={(v) => updateStatus(v as RiskAnalysisStatus)}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="draft">Concept</SelectItem>
              <SelectItem value="published">Gepubliceerd</SelectItem>
              <SelectItem value="archived">Gearchiveerd</SelectItem>
            </SelectContent>
          </Select>
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
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Bruto R ≥ 200</div>
            <div className="text-2xl font-bold mt-1 text-orange-600">{stats.grossHigh}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Netto R ≥ 200</div>
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

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Items ({items?.length ?? 0})</h2>
          <Button size="sm" onClick={() => setEditItem({ position: (items?.length ?? 0) + 1, measure_types: [] })}>
            <Plus className="w-4 h-4" /> Item toevoegen
          </Button>
        </div>

        {!items || items.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground">
            <ShieldAlert className="w-10 h-10 mx-auto mb-2 opacity-40" />
            Nog geen items in deze versie.
          </div>
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
                      <RiskBadge r={it.score_r} />
                      <div className="text-[10px] text-muted-foreground font-mono mt-1">
                        W{it.score_w ?? "—"} · B{it.score_b ?? "—"} · E{it.score_e ?? "—"}
                      </div>
                    </td>
                    <td className="py-3 px-2 max-w-md">
                      {it.measures ? (
                        <div className="text-xs whitespace-pre-line line-clamp-3">{it.measures}</div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                      {it.measure_types.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {it.measure_types.map((m) => (
                            <Badge key={m} variant="outline" className="text-[10px] py-0">{MEASURE_TYPE_LABELS[m]}</Badge>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <RiskBadge r={it.residual_r} />
                      {it.residual_w != null && (
                        <div className="text-[10px] text-muted-foreground font-mono mt-1">
                          W{it.residual_w} · B{it.residual_b} · E{it.residual_e}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => setEditItem(it)}>
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
  item, onClose, onChange, onSave,
}: {
  item: Partial<Item> | null;
  onClose: () => void;
  onChange: (i: Partial<Item>) => void;
  onSave: () => void;
}) {
  if (!item) return null;
  const grossR = computeR(item.score_w ?? null, item.score_b ?? null, item.score_e ?? null);
  const netR = computeR(item.residual_w ?? null, item.residual_b ?? null, item.residual_e ?? null);

  const toggleType = (t: RiskMeasureType) => {
    const cur = item.measure_types ?? [];
    onChange({ ...item, measure_types: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] });
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
              <RiskBadge r={grossR} />
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <div><Label className="text-[10px] uppercase">W · Waarschijnlijkheid</Label>
                <ScoreSelect value={item.score_w} onChange={(v) => onChange({ ...item, score_w: v })} scale={W_SCALE} placeholder="W" />
              </div>
              <div><Label className="text-[10px] uppercase">B · Blootstelling</Label>
                <ScoreSelect value={item.score_b} onChange={(v) => onChange({ ...item, score_b: v })} scale={B_SCALE} placeholder="B" />
              </div>
              <div><Label className="text-[10px] uppercase">E · Effect</Label>
                <ScoreSelect value={item.score_e} onChange={(v) => onChange({ ...item, score_e: v })} scale={E_SCALE} placeholder="E" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Risicoreductie / maatregelen</Label>
            <Textarea rows={4} value={item.measures ?? ""} onChange={(e) => onChange({ ...item, measures: e.target.value })} />
            <div className="flex gap-4 pt-1">
              {(Object.keys(MEASURE_TYPE_LABELS) as RiskMeasureType[]).map((t) => (
                <label key={t} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={item.measure_types?.includes(t) ?? false}
                    onCheckedChange={() => toggleType(t)}
                  />
                  {MEASURE_TYPE_LABELS[t]}
                </label>
              ))}
            </div>
          </div>

          <div className="border rounded-md p-3 space-y-3 bg-muted/30">
            <div className="flex items-center justify-between">
              <div className="font-medium text-sm">Restrisico (na maatregelen)</div>
              <RiskBadge r={netR} />
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <div><Label className="text-[10px] uppercase">W′</Label>
                <ScoreSelect value={item.residual_w} onChange={(v) => onChange({ ...item, residual_w: v })} scale={W_SCALE} placeholder="W" />
              </div>
              <div><Label className="text-[10px] uppercase">B′</Label>
                <ScoreSelect value={item.residual_b} onChange={(v) => onChange({ ...item, residual_b: v })} scale={B_SCALE} placeholder="B" />
              </div>
              <div><Label className="text-[10px] uppercase">E′</Label>
                <ScoreSelect value={item.residual_e} onChange={(v) => onChange({ ...item, residual_e: v })} scale={E_SCALE} placeholder="E" />
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
