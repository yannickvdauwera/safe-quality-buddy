import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { EVALUATION_SECTIONS, SCORE_OPTIONS, ALL_CRITERIA } from "@/lib/evaluation-criteria";
import { SignaturePad } from "@/components/SignaturePad";
import { useDraftForm } from "@/hooks/useDraftForm";
import { RestoreDraftDialog, UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  employeeId: string;
  employeeName: string;
  existing?: {
    id: string;
    evaluator_name: string;
    employee_name: string;
    location: string;
    scores: Record<string, string>;
    notes: string | null;
    evaluated_on: string;
    evaluator_signature?: string | null;
  } | null;
}

export function EvaluationForm({ open, onOpenChange, employeeId, employeeName, existing }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const defaultEvaluator =
    (user?.user_metadata as { full_name?: string } | undefined)?.full_name ?? user?.email ?? "";

  const [form, setForm] = useState({
    evaluator_name: existing?.evaluator_name ?? defaultEvaluator,
    employee_name: existing?.employee_name ?? employeeName,
    location: existing?.location ?? "",
    evaluated_on: existing?.evaluated_on ?? new Date().toISOString().slice(0, 10),
    notes: existing?.notes ?? "",
  });
  const [scores, setScores] = useState<Record<string, string>>(existing?.scores ?? {});
  const [signature, setSignature] = useState<string | null>(existing?.evaluator_signature ?? null);

  const setScore = (k: string, v: string) => setScores((s) => ({ ...s, [k]: v }));

  // ---------- Concept / draft ----------
  const [submitted, setSubmitted] = useState(false);
  const [showCloseGuard, setShowCloseGuard] = useState(false);
  const values = { form, scores, signature };
  const initialRef = useRef(JSON.stringify(values));
  const isDirty = useMemo(() => JSON.stringify(values) !== initialRef.current, [values]);
  const draft = useDraftForm({
    formType: "evaluation",
    formKey: employeeId,
    values,
    isDirty,
    isSubmitted: submitted,
    title: `Evaluatie — ${employeeName}`,
    enabled: !existing && open,
  });
  const applyDraft = (p: typeof values) => {
    if (p.form) setForm(p.form);
    if (p.scores) setScores(p.scores);
    if (typeof p.signature !== "undefined") setSignature(p.signature);
  };
  const handleClose = (next: boolean) => {
    if (!next && isDirty && !submitted && !existing) {
      setShowCloseGuard(true);
      return;
    }
    onOpenChange(next);
  };


  const save = useMutation({
    mutationFn: async () => {
      if (!form.evaluator_name.trim()) throw new Error("Ingediend door is verplicht");
      if (!form.employee_name.trim()) throw new Error("Naam medewerker is verplicht");
      if (!form.location.trim()) throw new Error("Locatie is verplicht");
      const missing = ALL_CRITERIA.filter((c) => !scores[c.key]);
      if (missing.length) throw new Error(`Nog ${missing.length} criteria niet gescoord`);
      if (!signature) throw new Error("Handtekening leidinggevende ontbreekt");

      const payload = {
        employee_id: employeeId,
        evaluator_id: user?.id ?? null,
        evaluator_name: form.evaluator_name.trim(),
        employee_name: form.employee_name.trim(),
        location: form.location.trim(),
        evaluated_on: form.evaluated_on,
        notes: form.notes.trim() || null,
        scores,
        evaluator_signature: signature,
      };

      if (existing) {
        const { error } = await supabase
          .from("employee_evaluations")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employee_evaluations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(existing ? "Evaluatie bijgewerkt" : "Evaluatie opgeslagen");
      qc.invalidateQueries({ queryKey: ["employee-evaluations", employeeId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Evaluatie bewerken" : "Nieuwe evaluatie"}</DialogTitle>
          <DialogDescription>
            Schaal: 3 goed · 2 voldoende · 1 onvoldoende · 0 slecht · N.v.t. = niet kunnen beoordelen
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Naam, Voornaam *</Label>
              <Input
                value={form.employee_name}
                onChange={(e) => setForm({ ...form, employee_name: e.target.value })}
                maxLength={255}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ingediend door *</Label>
              <Input
                value={form.evaluator_name}
                onChange={(e) => setForm({ ...form, evaluator_name: e.target.value })}
                maxLength={255}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Locatie *</Label>
              <Input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                maxLength={255}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Datum evaluatie</Label>
              <Input
                type="date"
                value={form.evaluated_on}
                onChange={(e) => setForm({ ...form, evaluated_on: e.target.value })}
              />
            </div>
          </div>

          {EVALUATION_SECTIONS.map((section) => (
            <div key={section.key} className="rounded-lg border p-3 space-y-2">
              <h3 className="font-medium text-sm">{section.title}</h3>
              <div className="space-y-2">
                {section.items.map((item) => (
                  <div key={item.key} className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-2 items-center">
                    <div className="text-sm">
                      <span className="text-muted-foreground mr-2">{item.key}</span>
                      {item.label}
                    </div>
                    <Select value={scores[item.key] ?? ""} onValueChange={(v) => setScore(item.key, v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Score…" />
                      </SelectTrigger>
                      <SelectContent>
                        {SCORE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="space-y-1.5">
            <Label>Duiding &amp; Nuancering</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Evt. de lage scores nuanceren, benoemen, duiden."
              maxLength={2000}
              rows={5}
            />
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <Label>Handtekening leidinggevende *</Label>
            {signature ? (
              <div className="space-y-2">
                <div className="border rounded-md bg-white p-2 flex justify-center">
                  <img src={signature} alt="Handtekening" className="max-h-40" />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => setSignature(null)}>
                  Opnieuw tekenen
                </Button>
              </div>
            ) : (
              <SignaturePad onSave={(dataUrl) => setSignature(dataUrl)} />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuleren</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Opslaan…" : "Opslaan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
