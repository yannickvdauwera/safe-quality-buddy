import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ClipboardCheck, Plus, Sparkles, Search, Calendar } from "lucide-react";
import { STATUS_LABELS } from "@/lib/toolbox-types";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/toolboxes/")({
  component: ToolboxLibrary,
});

function ToolboxLibrary() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: toolboxes, isLoading } = useQuery({
    queryKey: ["toolboxes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("toolboxes")
        .select("id, title, description, category, status, current_version, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: recentSessions } = useQuery({
    queryKey: ["toolbox-sessions-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("toolbox_sessions")
        .select("id, status, scheduled_at, given_at, location, toolboxes(title)")
        .order("scheduled_at", { ascending: false, nullsFirst: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
  });

  const filtered = (toolboxes ?? []).filter((t) =>
    !search || t.title.toLowerCase().includes(search.toLowerCase()) || (t.category ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Toolboxen</h1>
            <p className="text-sm text-muted-foreground mt-1">Bibliotheek van toolbox-onderwerpen met versiebeheer en sessies.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/toolboxes/new", search: { mode: "ai" } })}>
              <Sparkles className="w-4 h-4" /> Genereer met AI
            </Button>
            <Button onClick={() => navigate({ to: "/toolboxes/new", search: { mode: "manual" } })}>
              <Plus className="w-4 h-4" /> Nieuwe toolbox
            </Button>
          </div>
        </div>

        {recentSessions && recentSessions.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-primary" />
              <h2 className="font-semibold text-sm">Recente sessies</h2>
            </div>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {recentSessions.map((s) => {
                const tb = s.toolboxes as unknown as { title: string } | null;
                const when = s.given_at ?? s.scheduled_at;
                return (
                  <Link
                    key={s.id}
                    to="/toolboxes/sessions/$id"
                    params={{ id: s.id }}
                    className="border rounded-md p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="font-medium text-sm truncate">{tb?.title ?? "—"}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] py-0">{s.status}</Badge>
                      {when && new Date(when).toLocaleDateString("nl-BE")}
                      {s.location && <span>• {s.location}</span>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </Card>
        )}

        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Zoek op titel of categorie..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Laden...</div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 text-center">
            <ClipboardCheck className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Nog geen toolboxen. Maak er één aan of genereer met AI.</p>
          </Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((t) => (
              <Link
                key={t.id}
                to="/toolboxes/$id"
                params={{ id: t.id }}
                className="block"
              >
                <Card className="p-4 h-full hover:border-primary/50 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold leading-tight flex-1">{t.title}</h3>
                    <Badge variant={t.status === "published" ? "default" : "secondary"} className="text-[10px]">
                      {STATUS_LABELS[t.status] ?? t.status}
                    </Badge>
                  </div>
                  {t.category && <div className="text-xs text-muted-foreground mb-2">{t.category}</div>}
                  {t.description && <p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>}
                  <div className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                    Versie {t.current_version} · bijgewerkt {new Date(t.updated_at).toLocaleDateString("nl-BE")}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
