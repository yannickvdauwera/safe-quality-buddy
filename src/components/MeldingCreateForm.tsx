import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useDraftForm } from "@/hooks/useDraftForm";
import { RestoreDraftDialog, UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";

interface Props {
  onClose: () => void;
  onCreated: () => void;
  typeOptions: { value: string; label: string }[];
  defaultType: string;
}

// Options based on the Monday.com forms shared by the customer.
const AO_TYPE_OPTIONS = [
  "Arbeidsongeval met werkverlet",
  "Arbeidsongeval zonder werkverlet",
  "EHBO",
  "Bijna-ongeval",
  "Verkeersongeval woon-werk",
];
const AO_CONTRACT_OPTIONS = [
  "Vast — TSA",
  "Interim",
  "Onderaannemer",
  "Stagiair",
  "Zelfstandige",
];
const AO_BODY_PARTS = [
  "Hoofd", "Oog", "Oor", "Nek", "Schouder", "Bovenarm", "Elleboog", "Onderarm",
  "Pols", "Hand", "Vinger", "Borstkas", "Rug", "Buik", "Heup", "Bovenbeen",
  "Knie", "Onderbeen", "Enkel", "Voet", "Teen", "Meerdere / algemeen",
];
const KLACHT_OPTIONS = [
  "Interne klacht",
  "Externe klacht (klant)",
  "Kwaliteitsincident",
  "Communicatie / gedrag",
  "Materiaal / uitrusting",
  "Andere",
];

export function MeldingCreateForm({ onClose, onCreated, typeOptions, defaultType }: Props) {
  const { user } = useAuth();
  const employeesQuery = useQuery({
    queryKey: ["employees-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("id,first_name,last_name,function_title,employer,active")
        .eq("active", true)
        .order("last_name", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });
  const employees = employeesQuery.data ?? [];
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<string>(defaultType);
  const [severity, setSeverity] = useState<string>("middel");

  // Shared
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [involvedFirm, setInvolvedFirm] = useState("");

  // AO / EHBO
  const [aoIncidentDate, setAoIncidentDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [aoIncidentType, setAoIncidentType] = useState<string>("");
  const [aoFirstAider, setAoFirstAider] = useState("");
  const [aoVictimName, setAoVictimName] = useState("");
  const [aoContractType, setAoContractType] = useState<string>("");
  const [aoBodyPart, setAoBodyPart] = useState<string>("");
  const [aoBodyDetail, setAoBodyDetail] = useState("");
  const [aoRelaas, setAoRelaas] = useState("");
  const [aoInvestigation, setAoInvestigation] = useState("");
  const [aoFiles, setAoFiles] = useState<File[]>([]);

  // Klacht / incident
  const [klSubmitterName, setKlSubmitterName] = useState("");
  const [klSubmitter, setKlSubmitter] = useState("");
  const [klEmail, setKlEmail] = useState("");
  const [klWorksite, setKlWorksite] = useState("");
  const [klDate, setKlDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [klCategory, setKlCategory] = useState<string>("");

  // ---------- Concept / draft ----------
  const [submitted, setSubmitted] = useState(false);
  const [showCloseGuard, setShowCloseGuard] = useState(false);
  const values = {
    type, severity, title, description, location, involvedFirm,
    aoIncidentDate, aoIncidentType, aoFirstAider, aoVictimName, aoContractType,
    aoBodyPart, aoBodyDetail, aoRelaas, aoInvestigation,
    klSubmitterName, klSubmitter, klEmail, klWorksite, klDate, klCategory,
  };
  const initialRef = useRef(JSON.stringify(values));
  const isDirty = useMemo(() => JSON.stringify(values) !== initialRef.current, [values]);
  const draftTitle = title || (type === "ao_ehbo" ? aoVictimName : type === "klacht" ? klSubmitterName : null) || "Melding (concept)";
  const draft = useDraftForm({
    formType: `melding:${defaultType}`,
    values,
    isDirty,
    isSubmitted: submitted,
    title: draftTitle,
  });

  const applyDraft = (p: typeof values) => {
    setType(p.type ?? defaultType);
    setSeverity(p.severity ?? "middel");
    setTitle(p.title ?? "");
    setDescription(p.description ?? "");
    setLocation(p.location ?? "");
    setInvolvedFirm(p.involvedFirm ?? "");
    setAoIncidentDate(p.aoIncidentDate ?? new Date().toISOString().slice(0, 10));
    setAoIncidentType(p.aoIncidentType ?? "");
    setAoFirstAider(p.aoFirstAider ?? "");
    setAoVictimName(p.aoVictimName ?? "");
    setAoContractType(p.aoContractType ?? "");
    setAoBodyPart(p.aoBodyPart ?? "");
    setAoBodyDetail(p.aoBodyDetail ?? "");
    setAoRelaas(p.aoRelaas ?? "");
    setAoInvestigation(p.aoInvestigation ?? "");
    setKlSubmitterName(p.klSubmitterName ?? "");
    setKlSubmitter(p.klSubmitter ?? "");
    setKlEmail(p.klEmail ?? "");
    setKlWorksite(p.klWorksite ?? "");
    setKlDate(p.klDate ?? new Date().toISOString().slice(0, 10));
    setKlCategory(p.klCategory ?? "");
  };

  const handleCancel = () => {
    if (isDirty && !submitted) setShowCloseGuard(true);
    else onClose();
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validation + auto-title per type
    let finalTitle = title.trim();
    const details: Record<string, unknown> = {};

    if (type === "ao_ehbo") {
      if (!aoIncidentType) return toast.error("Kies een type incident");
      if (!aoVictimName.trim()) return toast.error("Slachtoffernaam is verplicht");
      if (!aoFirstAider.trim()) return toast.error("Hulpverlener is verplicht");
      if (!location.trim()) return toast.error("Locatie is verplicht");
      if (!aoContractType) return toast.error("Type contract is verplicht");
      if (!aoBodyPart) return toast.error("Lichaamsdeel is verplicht");
      if (!aoBodyDetail.trim()) return toast.error("Detail van de gekwetste lichaamsdelen is verplicht");
      if (!aoRelaas.trim()) return toast.error("Relaas is verplicht");
      if (!aoInvestigation.trim()) return toast.error("Ongevallenonderzoek is verplicht");
      // Auto-title: "ddmmyyyy - Achternaam" zoals in Monday
      const d = new Date(aoIncidentDate);
      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const surname = aoVictimName.split(/[,\s]+/)[0] || aoVictimName;
      finalTitle = finalTitle || `${dd}${mm}${yyyy} - ${surname}`;
      Object.assign(details, {
        incident_date: aoIncidentDate,
        incident_type: aoIncidentType,
        first_aider: aoFirstAider,
        victim_name: aoVictimName,
        contract_type: aoContractType,
        body_part: aoBodyPart,
        body_detail: aoBodyDetail,
        relaas: aoRelaas,
        investigation: aoInvestigation,
      });
    } else if (type === "klacht") {
      if (!klSubmitterName.trim()) return toast.error("Achternaam, Voornaam is verplicht");
      if (!klCategory) return toast.error("Kies een categorie klacht/incident");
      if (!description.trim()) return toast.error("Beschrijving is verplicht");
      finalTitle = finalTitle || `${klCategory} — ${klSubmitterName}`;
      Object.assign(details, {
        submitter_name: klSubmitterName,
        submitter_role: klSubmitter,
        submitter_email: klEmail,
        worksite: klWorksite,
        incident_date: klDate,
        category: klCategory,
      });
    } else {
      if (!finalTitle || finalTitle.length < 3) return toast.error("Titel is verplicht");
    }

    setSaving(true);
    const payload = {
      type,
      severity,
      title: finalTitle.slice(0, 200),
      description: description.trim() || null,
      location: (type === "klacht" ? klWorksite : location).trim() || null,
      involved_firm: involvedFirm.trim() || null,
      reporter_id: user.id,
      observed_at: type === "ao_ehbo"
        ? new Date(aoIncidentDate).toISOString()
        : type === "klacht"
        ? new Date(klDate).toISOString()
        : new Date().toISOString(),
      details,
    };
    const { data: inserted, error } = await supabase
      .from("reports")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) {
      setSaving(false);
      return toast.error(error.message);
    }

    // Upload bijlagen (foto's / documenten ongevallenonderzoek)
    if (type === "ao_ehbo" && aoFiles.length > 0 && inserted) {
      const uploaded: { path: string; name: string; type: string }[] = [];
      for (const f of aoFiles) {
        const path = `${inserted.id}/${Date.now()}-${f.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const { error: upErr } = await supabase.storage
          .from("reports-attachments")
          .upload(path, f, { upsert: false });
        if (!upErr) uploaded.push({ path, name: f.name, type: f.type });
      }
      if (uploaded.length > 0) {
        await supabase
          .from("reports")
          .update({ details: { ...details, attachments: uploaded } as never })
          .eq("id", inserted.id);
      }
    }

    setSaving(false);
    setSubmitted(true);
    await draft.deleteDraft();
    toast.success("Melding aangemaakt");
    onCreated();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Type melding *</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {typeOptions.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ==================== AO / EHBO ==================== */}
      {type === "ao_ehbo" && (
        <>
          <Separator />
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Arbeidsongeval / EHBO</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Datum incident *</Label>
              <Input type="date" value={aoIncidentDate} onChange={(e) => setAoIncidentDate(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Type incident *</Label>
              <Select value={aoIncidentType} onValueChange={setAoIncidentType}>
                <SelectTrigger><SelectValue placeholder="Kies…" /></SelectTrigger>
                <SelectContent>
                  {AO_TYPE_OPTIONS.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Slachtoffernaam *</Label>
              <Input
                list="employees-datalist"
                value={aoVictimName}
                onChange={(e) => {
                  const v = e.target.value;
                  setAoVictimName(v);
                  const match = employees.find(
                    (emp) => `${emp.last_name}, ${emp.first_name}` === v,
                  );
                  if (match) {
                    if (!involvedFirm && match.employer) setInvolvedFirm(match.employer);
                  }
                }}
                placeholder="Achternaam, Voornaam (kies uit lijst of typ zelf)"
                required
              />
              <datalist id="employees-datalist">
                {employees.map((emp) => (
                  <option
                    key={emp.id}
                    value={`${emp.last_name}, ${emp.first_name}`}
                  >
                    {emp.function_title ?? ""}{emp.employer ? ` — ${emp.employer}` : ""}
                  </option>
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label>Hulpverlener *</Label>
              <Input value={aoFirstAider} onChange={(e) => setAoFirstAider(e.target.value)} placeholder="Naam EHBO/hulpverlener" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type contract *</Label>
              <Select value={aoContractType} onValueChange={setAoContractType}>
                <SelectTrigger><SelectValue placeholder="Kies…" /></SelectTrigger>
                <SelectContent>
                  {AO_CONTRACT_OPTIONS.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Locatie *</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Plant / werf / zone" required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Lichaamsdeel *</Label>
              <Select value={aoBodyPart} onValueChange={setAoBodyPart}>
                <SelectTrigger><SelectValue placeholder="Kies…" /></SelectTrigger>
                <SelectContent>
                  {AO_BODY_PARTS.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Betrokken firma</Label>
              <Input value={involvedFirm} onChange={(e) => setInvolvedFirm(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Detail van de gekwetste lichaamsdelen *</Label>
            <Input value={aoBodyDetail} onChange={(e) => setAoBodyDetail(e.target.value)} placeholder="bv. linker wijsvinger, bovenkant" required />
          </div>
          <div className="space-y-1.5">
            <Label>Relaas *</Label>
            <Textarea rows={4} value={aoRelaas} onChange={(e) => setAoRelaas(e.target.value)} maxLength={4000} placeholder="Wat is er precies gebeurd?" required />
          </div>
          <div className="space-y-1.5">
            <Label>Ongevallenonderzoek *</Label>
            <Textarea rows={3} value={aoInvestigation} onChange={(e) => setAoInvestigation(e.target.value)} maxLength={4000} placeholder="Oorzaken, vaststellingen, genomen maatregelen…" required />
          </div>
          <div className="space-y-1.5">
            <Label>Bijlagen (foto's, PV, verklaringen…)</Label>
            <Input
              type="file"
              multiple
              accept="image/*,application/pdf,.doc,.docx"
              onChange={(e) => setAoFiles(Array.from(e.target.files ?? []))}
            />
            {aoFiles.length > 0 && (
              <p className="text-xs text-muted-foreground">{aoFiles.length} bestand(en) geselecteerd</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Korte titel (optioneel)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Wordt automatisch samengesteld (ddmmyyyy - achternaam)" />
          </div>
        </>
      )}

      {/* ==================== KLACHT / INCIDENT ==================== */}
      {type === "klacht" && (
        <>
          <Separator />
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium">Interne klacht / incident</p>
          <div className="space-y-1.5">
            <Label>Achternaam, Voornaam *</Label>
            <Input value={klSubmitterName} onChange={(e) => setKlSubmitterName(e.target.value)} placeholder="bv. Peeters, Jos" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Indiener (functie/rol)</Label>
              <Input value={klSubmitter} onChange={(e) => setKlSubmitter(e.target.value)} placeholder="bv. Werfleider" />
            </div>
            <div className="space-y-1.5">
              <Label>Email indiener</Label>
              <Input type="email" value={klEmail} onChange={(e) => setKlEmail(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Werf / Locatie / Klant</Label>
              <Input value={klWorksite} onChange={(e) => setKlWorksite(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Datum *</Label>
              <Input type="date" value={klDate} onChange={(e) => setKlDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Klacht / Incident *</Label>
            <Select value={klCategory} onValueChange={setKlCategory}>
              <SelectTrigger><SelectValue placeholder="Kies…" /></SelectTrigger>
              <SelectContent>
                {KLACHT_OPTIONS.map((o) => (<SelectItem key={o} value={o}>{o}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Beschrijving *</Label>
            <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} placeholder="Geef hier een bondige omschrijving van de situatie." required />
          </div>
          <div className="space-y-1.5">
            <Label>Korte titel (optioneel)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Wordt automatisch samengesteld indien leeg" />
          </div>
        </>
      )}

      {/* ==================== GENERIEK ==================== */}
      {type !== "ao_ehbo" && type !== "klacht" && (
        <>
          <Separator />
          <div className="space-y-1.5">
            <Label>Titel *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} required placeholder="Korte samenvatting" />
          </div>
          <div className="space-y-1.5">
            <Label>Beschrijving</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} placeholder="Wat is er vastgesteld? Waar? Waarom?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Locatie</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Plant / afdeling / zone" />
            </div>
            <div className="space-y-1.5">
              <Label>Betrokken firma</Label>
              <Input value={involvedFirm} onChange={(e) => setInvolvedFirm(e.target.value)} />
            </div>
          </div>
        </>
      )}

      <DialogFooter className="gap-2">
        {draft.lastSavedAt && !submitted && (
          <span className="text-xs text-muted-foreground mr-auto self-center">
            Concept opgeslagen · {new Date(draft.lastSavedAt).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        <Button type="button" variant="outline" onClick={handleCancel}>Annuleren</Button>
        <Button
          type="button"
          variant="secondary"
          disabled={!isDirty || draft.saving || submitted}
          onClick={() => draft.saveNow()}
        >
          {draft.saving ? "Opslaan…" : "Concept opslaan"}
        </Button>
        <Button type="submit" disabled={saving}>Registreren</Button>
      </DialogFooter>

      <UnsavedChangesDialog
        open={showCloseGuard}
        onOpenChange={setShowCloseGuard}
        saving={draft.saving}
        onSaveDraft={async () => {
          await draft.saveNow();
          setShowCloseGuard(false);
          onClose();
        }}
        onDiscard={async () => {
          await draft.deleteDraft();
          setShowCloseGuard(false);
          onClose();
        }}
      />
      <RestoreDraftDialog
        open={!!draft.existingDraft && draft.checkedForDraft}
        lastSavedAt={draft.existingDraft?.last_saved_at}
        onRestore={() => {
          if (draft.existingDraft) {
            applyDraft(draft.existingDraft.payload as typeof values);
            initialRef.current = JSON.stringify(draft.existingDraft.payload);
          }
          draft.dismissRestore();
        }}
        onDiscard={async () => {
          await draft.deleteDraft();
          draft.dismissRestore();
        }}
      />
    </form>
  );
}

