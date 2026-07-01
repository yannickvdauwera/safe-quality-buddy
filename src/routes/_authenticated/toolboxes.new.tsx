import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, Save, Loader2, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { generateToolbox } from "@/lib/toolbox-ai.functions";
import { TOOLBOX_CATEGORIES, EMPTY_CONTENT, type ToolboxContent } from "@/lib/toolbox-types";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({ mode: z.enum(["manual", "ai"]).optional() });

export const Route = createFileRoute("/_authenticated/toolboxes/new")({
  validateSearch: searchSchema,
  component: NewToolbox,
});

function ListEditor({ label, items, onChange }: { label: string; items: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea
        value={items.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n").map((s) => s.trimStart()).filter((_, i, a) => i < a.length))}
        rows={5}
        placeholder="Eén item per regel"
      />
      <p className="text-xs text-muted-foreground">Eén item per regel</p>
    </div>
  );
}

function NewToolbox() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const generate = useServerFn(generateToolbox);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>(TOOLBOX_CATEGORIES[TOOLBOX_CATEGORIES.length - 1]);
  const [content, setContent] = useState<ToolboxContent>(EMPTY_CONTENT);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"draft" | "published">("draft");

  const runAi = async () => {
    if (prompt.trim().length < 3) {
      toast.error("Geef een korte beschrijving van het onderwerp");
      return;
    }
    setGenerating(true);
    try {
      const result = await generate({ data: { prompt, category } });
      setTitle(result.title);
      setDescription(result.description);
      setCategory(result.category);
      setContent(result.content);
      toast.success("Toolbox gegenereerd — je kan nog aanpassen voor je opslaat");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Fout bij genereren";
      toast.error(msg);
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (!title.trim()) return toast.error("Titel is verplicht");
    if (!user) return;
    setSaving(true);
    try {
      const { data: tb, error: tbErr } = await supabase
        .from("toolboxes")
        .insert({ title: title.trim(), description: description.trim() || null, category, status, current_version: 1, created_by: user.id })
        .select("id")
        .single();
      if (tbErr) throw tbErr;

      const { error: verErr } = await supabase.from("toolbox_versions").insert({
        toolbox_id: tb.id,
        version_number: 1,
        content: content as never,
        change_notes: "Initiële versie",
        created_by: user.id,
        published_at: status === "published" ? new Date().toISOString() : null,
      });
      if (verErr) throw verErr;

      toast.success("Toolbox opgeslagen");
      navigate({ to: "/toolboxes/$id", params: { id: tb.id } });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fout bij opslaan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/toolboxes" })}>
          <ArrowLeft className="w-4 h-4" /> Terug naar bibliotheek
        </Button>
        <h1 className="text-2xl font-bold">Nieuwe toolbox</h1>

        {mode === "ai" && (
          <Card className="p-5 border-primary/30 bg-primary/5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Genereer met AI</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Beschrijf het onderwerp — de AI stelt een toolbox op die je nadien vrij kan bewerken.
            </p>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="Bv. Werken op hoogte bij het vervangen van kleppen op petrochemische lijnen"
            />
            <div className="flex gap-2 mt-3">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                <SelectContent>{TOOLBOX_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={runAi} disabled={generating}>
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {generating ? "Bezig..." : "Genereer"}
              </Button>
            </div>
          </Card>
        )}

        <Card className="p-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Titel *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel van de toolbox" />
            </div>
            <div className="space-y-2">
              <Label>Categorie</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TOOLBOX_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Korte beschrijving</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Waar gaat deze toolbox over?" />
          </div>
          <div className="space-y-2">
            <Label>Doelstelling</Label>
            <Textarea value={content.objective} onChange={(e) => setContent({ ...content, objective: e.target.value })} rows={2} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <ListEditor label="Gevaren" items={content.hazards} onChange={(v) => setContent({ ...content, hazards: v })} />
            <ListEditor label="Preventiemaatregelen" items={content.measures} onChange={(v) => setContent({ ...content, measures: v })} />
            <ListEditor label="Checklist" items={content.checklist} onChange={(v) => setContent({ ...content, checklist: v })} />
            <ListEditor label="Discussievragen" items={content.questions} onChange={(v) => setContent({ ...content, questions: v })} />
          </div>
        </Card>

        <div className="flex items-center justify-between border-t pt-4">
          <div className="flex items-center gap-3">
            <Label>Status:</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as "draft" | "published")}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Concept</SelectItem>
                <SelectItem value="published">Gepubliceerd</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Opslaan..." : "Toolbox opslaan"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
