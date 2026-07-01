import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface ChecklistQuestion {
  key: string;   // stable key stored in details.answers
  label: string; // full question text
}
export interface ChecklistSection {
  title: string;
  questions: ChecklistQuestion[];
}
export interface ChecklistConfig {
  reportType: string;
  headerFields: Array<
    | { key: string; label: string; type: "text" | "date"; required?: boolean; placeholder?: string }
  >;
  sections: ChecklistSection[];
  /** Auto title template using header field keys, e.g. `WPI — {victim} @ {location}` */
  titleTemplate: (h: Record<string, string>) => string;
  extraTextFields?: Array<{ key: string; label: string; placeholder?: string; required?: boolean; rows?: number }>;
}

const ANSWERS: Array<{ value: "ok" | "nok" | "nvt"; label: string; cls: string }> = [
  { value: "ok",  label: "OK",  cls: "data-[state=on]:bg-emerald-600 data-[state=on]:text-white" },
  { value: "nok", label: "NOK", cls: "data-[state=on]:bg-destructive data-[state=on]:text-destructive-foreground" },
  { value: "nvt", label: "NVT", cls: "data-[state=on]:bg-muted data-[state=on]:text-foreground" },
];

interface Props {
  onClose: () => void;
  onCreated: () => void;
  config: ChecklistConfig;
}

export function ChecklistCreateForm({ onClose, onCreated, config }: Props) {
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [severity, setSeverity] = useState<string>("middel");
  const [header, setHeader] = useState<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    config.headerFields.forEach((f) => (out[f.key] = f.type === "date" ? new Date().toISOString().slice(0, 10) : ""));
    return out;
  });
  const [answers, setAnswers] = useState<Record<string, "ok" | "nok" | "nvt">>({});
  const [extras, setExtras] = useState<Record<string, string>>({});

  const totalQ = config.sections.reduce((s, sec) => s + sec.questions.length, 0);
  const answered = Object.keys(answers).length;
  const nokCount = Object.values(answers).filter((v) => v === "nok").length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    for (const f of config.headerFields) {
      if (f.required && !header[f.key]?.trim()) return toast.error(`${f.label} is verplicht`);
    }
    if (config.extraTextFields) {
      for (const f of config.extraTextFields) {
        if (f.required && !extras[f.key]?.trim()) return toast.error(`${f.label} is verplicht`);
      }
    }

    setSaving(true);
    const title = config.titleTemplate(header).slice(0, 200);
    const payload = {
      type: config.reportType,
      severity,
      title,
      description: extras["general_notes"] || null,
      location: header["location"] || header["worksite"] || null,
      involved_firm: header["employer"] || null,
      reporter_id: user.id,
      observed_at: header["date"] ? new Date(header["date"]).toISOString() : new Date().toISOString(),
      details: {
        header,
        answers,
        extras,
        stats: { total: totalQ, answered, nok: nokCount },
      },
    };
    const { error } = await supabase.from("reports").insert(payload as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Inspectie geregistreerd");
    onCreated();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Header fields */}
      <div className="grid grid-cols-2 gap-3">
        {config.headerFields.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <Label>{f.label}{f.required ? " *" : ""}</Label>
            <Input
              type={f.type}
              value={header[f.key] ?? ""}
              onChange={(e) => setHeader((h) => ({ ...h, [f.key]: e.target.value }))}
              placeholder={f.placeholder}
              required={f.required}
            />
          </div>
        ))}
        <div className="space-y-1.5">
          <Label>Ernst *</Label>
          <select
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="laag">Laag</option>
            <option value="middel">Middel</option>
            <option value="hoog">Hoog</option>
            <option value="kritiek">Kritiek</option>
          </select>
        </div>
      </div>

      {/* Progress banner */}
      <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-xs">
        <span>Beantwoord: <b>{answered}</b> / {totalQ}</span>
        <span>NOK: <b className={nokCount > 0 ? "text-destructive" : ""}>{nokCount}</b></span>
      </div>

      {/* Sections */}
      {config.sections.map((sec) => (
        <div key={sec.title} className="space-y-2">
          <Separator />
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{sec.title}</p>
          <div className="space-y-2">
            {sec.questions.map((q) => (
              <div key={q.key} className="flex items-start justify-between gap-3 border rounded-md p-2.5">
                <div className="text-sm flex-1 leading-snug">{q.label}</div>
                <div className="flex gap-1 shrink-0">
                  {ANSWERS.map((a) => {
                    const active = answers[q.key] === a.value;
                    return (
                      <button
                        type="button"
                        key={a.value}
                        data-state={active ? "on" : "off"}
                        onClick={() => setAnswers((prev) => ({ ...prev, [q.key]: a.value }))}
                        className={cn(
                          "px-2.5 py-1 rounded text-xs font-medium border transition-colors",
                          active ? a.cls : "bg-background hover:bg-muted",
                        )}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Extras */}
      {config.extraTextFields && config.extraTextFields.length > 0 && (
        <>
          <Separator />
          {config.extraTextFields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label>{f.label}{f.required ? " *" : ""}</Label>
              <Textarea
                rows={f.rows ?? 3}
                value={extras[f.key] ?? ""}
                onChange={(e) => setExtras((p) => ({ ...p, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                maxLength={2000}
              />
            </div>
          ))}
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>Annuleren</Button>
        <Button type="submit" disabled={saving}>Registreren</Button>
      </DialogFooter>
    </form>
  );
}
