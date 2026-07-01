import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { HAZARDS, RISKS, TYPE_LABELS, type SafetyObservationType } from "@/lib/safety-observations";

interface Props {
  type: SafetyObservationType;
  onDone: () => void;
}

export function SafetyObservationForm({ type, onDone }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    reporter_name: user?.user_metadata?.full_name ?? user?.email ?? "",
    reporter_function: "",
    observed_date: new Date().toISOString().slice(0, 10),
    observed_time: new Date().toTimeString().slice(0, 5),
    plant: "",
    area: "",
    location: "",
    involved_party: "",
    situation_description: "",
    action_taken: "",
    improvement_proposal: "",
    company_action: "",
  });
  const [hazards, setHazards] = useState<string[]>([]);
  const [risks, setRisks] = useState<string[]>([]);

  const toggle = (arr: string[], setArr: (v: string[]) => void, v: string) =>
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const upd = <K extends keyof typeof form>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Niet ingelogd");
      if (!form.reporter_name.trim()) throw new Error("Naam is verplicht");
      const { error } = await supabase.from("safety_observations").insert({
        type,
        reporter_id: user.id,
        ...form,
        observed_time: form.observed_time || null,
        hazards,
        risks,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${TYPE_LABELS[type].title} opgeslagen`);
      qc.invalidateQueries({ queryKey: ["safety_observations", type] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Naam *</Label>
          <Input value={form.reporter_name} onChange={(e) => upd("reporter_name", e.target.value)} required maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label>Functie</Label>
          <Input value={form.reporter_function} onChange={(e) => upd("reporter_function", e.target.value)} maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label>Datum</Label>
          <Input type="date" value={form.observed_date} onChange={(e) => upd("observed_date", e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <Label>Tijdstip</Label>
          <Input type="time" value={form.observed_time} onChange={(e) => upd("observed_time", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Plant</Label>
          <Input value={form.plant} onChange={(e) => upd("plant", e.target.value)} maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label>Area</Label>
          <Input value={form.area} onChange={(e) => upd("area", e.target.value)} maxLength={120} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Locatie</Label>
          <Input value={form.location} onChange={(e) => upd("location", e.target.value)} maxLength={200} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label>Betrokken firma / persoon</Label>
          <Input value={form.involved_party} onChange={(e) => upd("involved_party", e.target.value)} maxLength={200} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <div className="font-medium mb-2 text-sm uppercase tracking-wide text-muted-foreground">Gevaar</div>
          <div className="border rounded-md p-3 max-h-72 overflow-y-auto space-y-2">
            {HAZARDS.map((h) => (
              <label key={h} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={hazards.includes(h)} onCheckedChange={() => toggle(hazards, setHazards, h)} />
                {h}
              </label>
            ))}
          </div>
        </div>
        <div>
          <div className="font-medium mb-2 text-sm uppercase tracking-wide text-muted-foreground">Risico</div>
          <div className="border rounded-md p-3 max-h-72 overflow-y-auto space-y-2">
            {RISKS.map((r) => (
              <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={risks.includes(r)} onCheckedChange={() => toggle(risks, setRisks, r)} />
                {r}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Omschrijving situatie</Label>
          <Textarea rows={3} value={form.situation_description} onChange={(e) => upd("situation_description", e.target.value)} maxLength={2000} />
        </div>
        <div className="space-y-1.5">
          <Label>Ondernomen actie</Label>
          <Textarea rows={3} value={form.action_taken} onChange={(e) => upd("action_taken", e.target.value)} maxLength={2000} />
        </div>
        <div className="space-y-1.5">
          <Label>Voorstel tot verbetering</Label>
          <Textarea rows={3} value={form.improvement_proposal} onChange={(e) => upd("improvement_proposal", e.target.value)} maxLength={2000} />
        </div>
        <div className="space-y-1.5">
          <Label>Actie van het bedrijf</Label>
          <Textarea rows={3} value={form.company_action} onChange={(e) => upd("company_action", e.target.value)} maxLength={2000} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>Annuleren</Button>
        <Button type="submit" disabled={create.isPending}>
          {create.isPending ? "Opslaan…" : "Opslaan"}
        </Button>
      </div>
    </form>
  );
}
