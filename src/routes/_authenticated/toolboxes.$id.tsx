import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Calendar, History, Plus, Save, Users } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { EMPTY_CONTENT, SESSION_STATUS_LABELS, STATUS_LABELS, TOOLBOX_CATEGORIES, type ToolboxContent } from "@/lib/toolbox-types";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/toolboxes/$id")({
  component: ToolboxDetail,
});

function ListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea
        value={items.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n"))}
        rows={5}
      />
    </div>
  );
}

function ToolboxDetail() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [newVersionOpen, setNewVersionOpen] = useState(false);
  const [planSessionOpen, setPlanSessionOpen] = useState(false);

  const { data: toolbox, isLoading } = useQuery({
    queryKey: ["toolbox", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("toolboxes").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: versions } = useQuery({
    queryKey: ["toolbox-versions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("toolbox_versions")
        .select("id, version_number, content, change_notes, published_at, created_at")
        .eq("toolbox_id", id)
        .order("version_number", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["toolbox-sessions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("toolbox_sessions")
        .select("id, status, scheduled_at, given_at, location")
        .eq("toolbox_id", id)
        .order("scheduled_at", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: employees } = useQuery({
    queryKey: ["employees-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id, first_name, last_name, function_title")
        .eq("active", true)
        .order("last_name");
      if (error) throw error;
      return data.map((e) => ({ id: e.id, full_name: `${e.first_name} ${e.last_name}`, function_title: e.function_title }));
    },
    enabled: planSessionOpen,
  });

  const currentVersion = versions?.find((v) => v.version_number === toolbox?.current_version) ?? versions?.[0];

  const updateMeta = async (patch: { title?: string; description?: string; category?: string; status?: "draft" | "published" | "archived" }) => {
    const { error } = await supabase.from("toolboxes").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["toolbox", id] });
  };

  if (isLoading || !toolbox) {
    return <AppShell><div className="text-sm text-muted-foreground">Laden...</div></AppShell>;
  }

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/toolboxes" })}>
          <ArrowLeft className="w-4 h-4" /> Terug
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={toolbox.status === "published" ? "default" : "secondary"}>
                {STATUS_LABELS[toolbox.status] ?? toolbox.status}
              </Badge>
              {toolbox.category && <Badge variant="outline">{toolbox.category}</Badge>}
              <span className="text-xs text-muted-foreground">Versie {toolbox.current_version}</span>
            </div>
            <h1 className="text-2xl font-bold">{toolbox.title}</h1>
            {toolbox.description && <p className="text-muted-foreground mt-1">{toolbox.description}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Dialog open={planSessionOpen} onOpenChange={setPlanSessionOpen}>
              <DialogTrigger asChild><Button><Calendar className="w-4 h-4" /> Sessie plannen</Button></DialogTrigger>
              <PlanSessionDialog
                toolboxId={id}
                currentVersionId={currentVersion?.id}
                employees={employees ?? []}
                onDone={(sessionId) => {
                  setPlanSessionOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["toolbox-sessions", id] });
                  navigate({ to: "/toolboxes/sessions/$id", params: { id: sessionId } });
                }}
                userId={user?.id ?? ""}
              />
            </Dialog>
            <Dialog open={newVersionOpen} onOpenChange={setNewVersionOpen}>
              <DialogTrigger asChild><Button variant="outline"><Plus className="w-4 h-4" /> Nieuwe versie</Button></DialogTrigger>
              <NewVersionDialog
                toolboxId={id}
                baseContent={(currentVersion?.content as ToolboxContent) ?? EMPTY_CONTENT}
                nextVersion={(toolbox.current_version ?? 0) + 1}
                onDone={() => {
                  setNewVersionOpen(false);
                  queryClient.invalidateQueries({ queryKey: ["toolbox-versions", id] });
                  queryClient.invalidateQueries({ queryKey: ["toolbox", id] });
                }}
                userId={user?.id ?? ""}
              />
            </Dialog>
          </div>
        </div>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><History className="w-4 h-4" /> Metadata</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Titel</Label>
              <Input defaultValue={toolbox.title} onBlur={(e) => e.target.value !== toolbox.title && updateMeta({ title: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Categorie</Label>
              <Select value={toolbox.category ?? ""} onValueChange={(v) => updateMeta({ category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TOOLBOX_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Beschrijving</Label>
              <Input defaultValue={toolbox.description ?? ""} onBlur={(e) => e.target.value !== toolbox.description && updateMeta({ description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={toolbox.status} onValueChange={(v) => updateMeta({ status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Concept</SelectItem>
                  <SelectItem value="published">Gepubliceerd</SelectItem>
                  <SelectItem value="archived">Gearchiveerd</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {currentVersion && (
          <Card className="p-5">
            <h2 className="font-semibold mb-4">Inhoud (huidige versie {currentVersion.version_number})</h2>
            <ContentView content={currentVersion.content as ToolboxContent} />
          </Card>
        )}

        <Card className="p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><History className="w-4 h-4" /> Versiegeschiedenis</h2>
          <div className="divide-y">
            {(versions ?? []).map((v) => (
              <div key={v.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">Versie {v.version_number}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(v.created_at).toLocaleString("nl-BE")}
                    {v.change_notes && ` · ${v.change_notes}`}
                  </div>
                </div>
                {toolbox.current_version === v.version_number && <Badge>Actueel</Badge>}
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> Sessies</h2>
          {sessions && sessions.length > 0 ? (
            <div className="divide-y">
              {sessions.map((s) => {
                const when = s.given_at ?? s.scheduled_at;
                return (
                  <Link
                    key={s.id}
                    to="/toolboxes/sessions/$id"
                    params={{ id: s.id }}
                    className="py-3 flex items-center justify-between hover:bg-muted/50 -mx-2 px-2 rounded"
                  >
                    <div>
                      <div className="text-sm font-medium">
                        {when ? new Date(when).toLocaleString("nl-BE") : "Nog niet gepland"}
                        {s.location && ` · ${s.location}`}
                      </div>
                      <div className="text-xs text-muted-foreground">{SESSION_STATUS_LABELS[s.status]}</div>
                    </div>
                    <Badge variant={s.status === "completed" ? "default" : "secondary"}>{SESSION_STATUS_LABELS[s.status]}</Badge>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nog geen sessies gepland.</p>
          )}
        </Card>
      </div>
    </AppShell>
  );
}

function ContentView({ content }: { content: ToolboxContent }) {
  const Section = ({ title, items }: { title: string; items?: string[] }) => {
    if (!items?.length) return null;
    return (
      <div>
        <div className="font-medium text-sm mb-1">{title}</div>
        <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
          {items.map((i, idx) => <li key={idx}>{i}</li>)}
        </ul>
      </div>
    );
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {content.objective && (
        <div className="md:col-span-2">
          <div className="font-medium text-sm mb-1">Doelstelling</div>
          <p className="text-sm text-muted-foreground">{content.objective}</p>
        </div>
      )}
      <Section title="Gevaren" items={content.hazards} />
      <Section title="Preventiemaatregelen" items={content.measures} />
      <Section title="Checklist" items={content.checklist} />
      <Section title="Discussievragen" items={content.questions} />
    </div>
  );
}

function NewVersionDialog({ toolboxId, baseContent, nextVersion, onDone, userId }: {
  toolboxId: string; baseContent: ToolboxContent; nextVersion: number; onDone: () => void; userId: string;
}) {
  const [content, setContent] = useState<ToolboxContent>(baseContent);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const { error: vErr } = await supabase.from("toolbox_versions").insert({
        toolbox_id: toolboxId,
        version_number: nextVersion,
        content: content as never,
        change_notes: notes || null,
        created_by: userId,
        published_at: new Date().toISOString(),
      });
      if (vErr) throw vErr;
      const { error: uErr } = await supabase.from("toolboxes").update({ current_version: nextVersion }).eq("id", toolboxId);
      if (uErr) throw uErr;
      toast.success(`Versie ${nextVersion} gepubliceerd`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fout");
    } finally { setSaving(false); }
  };

  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Nieuwe versie {nextVersion}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Wijzigingsnota's</Label>
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Wat is er gewijzigd?" />
        </div>
        <div className="space-y-2">
          <Label>Doelstelling</Label>
          <Textarea value={content.objective} onChange={(e) => setContent({ ...content, objective: e.target.value })} rows={2} />
        </div>
        <ListEditor label="Gevaren" items={content.hazards} onChange={(v) => setContent({ ...content, hazards: v })} />
        <ListEditor label="Preventiemaatregelen" items={content.measures} onChange={(v) => setContent({ ...content, measures: v })} />
        <ListEditor label="Checklist" items={content.checklist} onChange={(v) => setContent({ ...content, checklist: v })} />
        <ListEditor label="Discussievragen" items={content.questions} onChange={(v) => setContent({ ...content, questions: v })} />
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}><Save className="w-4 h-4" /> {saving ? "Opslaan..." : "Publiceer versie"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function PlanSessionDialog({ toolboxId, currentVersionId, employees, onDone, userId }: {
  toolboxId: string;
  currentVersionId?: string;
  employees: Array<{ id: string; full_name: string; function_title: string | null }>;
  onDone: (sessionId: string) => void;
  userId: string;
}) {
  const [scheduledAt, setScheduledAt] = useState(new Date().toISOString().slice(0, 16));
  const [location, setLocation] = useState("");
  const [givenBy, setGivenBy] = useState<string>("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelected(s);
  };

  const save = async () => {
    if (!currentVersionId) return toast.error("Geen versie beschikbaar");
    if (selected.size === 0) return toast.error("Selecteer minstens één deelnemer");
    setSaving(true);
    try {
      const { data: session, error } = await supabase
        .from("toolbox_sessions")
        .insert({
          toolbox_id: toolboxId,
          version_id: currentVersionId,
          scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
          location: location || null,
          given_by_employee_id: givenBy || null,
          status: "planned",
          created_by: userId,
        })
        .select("id")
        .single();
      if (error) throw error;

      const rows = [...selected].map((eid) => ({ session_id: session.id, employee_id: eid }));
      const { error: pErr } = await supabase.from("toolbox_session_participants").insert(rows);
      if (pErr) throw pErr;

      toast.success("Sessie aangemaakt");
      onDone(session.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fout");
    } finally { setSaving(false); }
  };

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Toolbox-sessie plannen</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Datum & tijdstip</Label>
            <Input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Locatie</Label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Bv. Werf INEOS PO1" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Gegeven door</Label>
            <Select value={givenBy} onValueChange={setGivenBy}>
              <SelectTrigger><SelectValue placeholder="Kies personeelslid..." /></SelectTrigger>
              <SelectContent>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name}{e.function_title ? ` — ${e.function_title}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="mb-2 block">Deelnemers ({selected.size} geselecteerd)</Label>
          <div className="border rounded max-h-64 overflow-y-auto divide-y">
            {employees.map((e) => (
              <label key={e.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 cursor-pointer text-sm">
                <input type="checkbox" checked={selected.has(e.id)} onChange={() => toggle(e.id)} />
                <span className="flex-1">{e.full_name}</span>
                {e.function_title && <span className="text-xs text-muted-foreground">{e.function_title}</span>}
              </label>
            ))}
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={saving}>{saving ? "Opslaan..." : "Sessie aanmaken"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
