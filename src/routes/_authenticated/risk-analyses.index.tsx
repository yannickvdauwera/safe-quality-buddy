import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ShieldAlert, Plus, Upload, Search } from "lucide-react";
import { STATUS_LABELS, TYPE_LABELS, type RiskAnalysisType } from "@/lib/risk-analysis-types";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/risk-analyses/")({
  component: RiskAnalysesLibrary,
});

function RiskAnalysesLibrary() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: analyses, isLoading } = useQuery({
    queryKey: ["risk-analyses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("risk_analyses")
        .select("id, title, description, analysis_type, workpost, department, status, current_version, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = (analyses ?? []).filter((a) => {
    if (typeFilter !== "all" && a.analysis_type !== typeFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      a.title.toLowerCase().includes(q) ||
      (a.workpost ?? "").toLowerCase().includes(q) ||
      (a.department ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Risicoanalyses</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Werkpostanalyses, TRA's en LMRA's volgens Fine & Kinney (W × B × E).
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate({ to: "/risk-analyses/new", search: { mode: "import" } })}>
            <Upload className="w-4 h-4" /> Importeer uit Excel
          </Button>
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
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle types</SelectItem>
            {(Object.keys(TYPE_LABELS) as RiskAnalysisType[]).map((t) => (
              <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Laden...</div>
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <ShieldAlert className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {analyses && analyses.length > 0
              ? "Geen analyses gevonden voor deze filter."
              : "Nog geen risicoanalyses. Maak er één aan of importeer uit Excel."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((a) => (
            <Link key={a.id} to="/risk-analyses/$id" params={{ id: a.id }} className="block">
              <Card className="p-4 h-full hover:border-primary/50 hover:shadow-sm transition-all">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold leading-tight flex-1">{a.title}</h3>
                  <Badge variant={a.status === "published" ? "default" : "secondary"} className="text-[10px]">
                    {STATUS_LABELS[a.status] ?? a.status}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <Badge variant="outline" className="text-[10px]">{TYPE_LABELS[a.analysis_type]}</Badge>
                  {a.workpost && <Badge variant="outline" className="text-[10px]">{a.workpost}</Badge>}
                  {a.department && <Badge variant="outline" className="text-[10px]">{a.department}</Badge>}
                </div>
                {a.description && <p className="text-sm text-muted-foreground line-clamp-2">{a.description}</p>}
                <div className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                  Versie {a.current_version} · bijgewerkt {new Date(a.updated_at).toLocaleDateString("nl-BE")}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
