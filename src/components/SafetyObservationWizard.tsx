import { useEffect, useMemo, useRef, useState } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Camera, Check, RotateCcw, Search, Trash2, X,
} from "lucide-react";
import {
  HAZARDS, RISKS, TYPE_LABELS, type SafetyObservationType,
} from "@/lib/safety-observations";

interface Props {
  type: SafetyObservationType;
  onDone: () => void;
  /** internal = logged-in; public = anonymous QR flow */
  mode?: "internal" | "public";
}

type UploadedPhoto = { path: string; previewUrl: string };

const STEPS = [
  "Melder",
  "Situatie",
  "Gevaar & Risico",
  "Acties",
  "Foto's",
  "Ondertekening",
] as const;

export function SafetyObservationWizard({ type, onDone, mode = "internal" }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const label = TYPE_LABELS[type];
  const [step, setStep] = useState(0);

  const [form, setForm] = useState({
    reporter_name: "",
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
    signer_name: "",
    signer_function: "",
  });
  const [hazards, setHazards] = useState<string[]>([]);
  const [risks, setRisks] = useState<string[]>([]);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [hazardQuery, setHazardQuery] = useState("");
  const [riskQuery, setRiskQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const sigRef = useRef<SignatureCanvas>(null);
  const [sigEmpty, setSigEmpty] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const upd = <K extends keyof typeof form>(k: K, v: string) =>
    setForm((f) => ({ ...f, [k]: v }));
  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  // Autofill from employees when internal
  useQuery({
    queryKey: ["employee-me", user?.id],
    enabled: mode === "internal" && !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("first_name,last_name,function_title")
        .eq("user_id", user!.id)
        .maybeSingle();
      const name = data
        ? `${data.first_name ?? ""} ${data.last_name ?? ""}`.trim()
        : (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";
      setForm((f) => ({
        ...f,
        reporter_name: f.reporter_name || name,
        reporter_function: f.reporter_function || data?.function_title || "",
        signer_name: f.signer_name || name,
        signer_function: f.signer_function || data?.function_title || "",
      }));
      return data ?? null;
    },
  });

  const filteredHazards = useMemo(
    () => HAZARDS.filter((h) => h.toLowerCase().includes(hazardQuery.toLowerCase())),
    [hazardQuery],
  );
  const filteredRisks = useMemo(
    () => RISKS.filter((r) => r.toLowerCase().includes(riskQuery.toLowerCase())),
    [riskQuery],
  );

  const compress = (file: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const reader = new FileReader();
      reader.onload = () => {
        img.onload = () => {
          const max = 1600;
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0, w, h);
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("compressie mislukt"))),
            "image/jpeg",
            0.82,
          );
        };
        img.onerror = () => reject(new Error("kan afbeelding niet laden"));
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error("kan bestand niet lezen"));
      reader.readAsDataURL(file);
    });

  const handleFiles = async (files: FileList | null) => {
    if (!files || !files.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const blob = await compress(file);
        const path = `${type}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage
          .from("safety-observations")
          .upload(path, blob, { contentType: "image/jpeg", upsert: false });
        if (error) throw error;
        setPhotos((p) => [...p, { path, previewUrl: URL.createObjectURL(blob) }]);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const removePhoto = async (path: string) => {
    await supabase.storage.from("safety-observations").remove([path]);
    setPhotos((p) => p.filter((x) => x.path !== path));
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!form.reporter_name.trim()) throw new Error("Naam melder is verplicht");
      let signature_data_url: string | null = null;
      if (sigRef.current && !sigRef.current.isEmpty()) {
        signature_data_url = sigRef.current.getCanvas().toDataURL("image/png");
      }
      const payload = {
        type,
        reporter_id: mode === "internal" ? user?.id ?? null : null,
        reporter_name: form.reporter_name,
        reporter_function: form.reporter_function || null,
        observed_date: form.observed_date,
        observed_time: form.observed_time || null,
        plant: form.plant || null,
        area: form.area || null,
        location: form.location || null,
        involved_party: form.involved_party || null,
        situation_description: form.situation_description || null,
        action_taken: form.action_taken || null,
        improvement_proposal: form.improvement_proposal || null,
        company_action: form.company_action || null,
        hazards,
        risks,
        photos: photos.map((p) => p.path),
        signature_data_url,
        signer_name: form.signer_name || form.reporter_name,
        signer_function: form.signer_function || form.reporter_function || null,
        submitted_via: mode === "public" ? "public" : "internal",
      };
      const { data, error } = await supabase
        .from("safety_observations")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success(`${label.title} succesvol ingediend`);
      qc.invalidateQueries({ queryKey: ["safety_observations", type] });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const canNext = () => {
    if (step === 0) return form.reporter_name.trim().length > 0;
    return true;
  };

  // Cleanup preview URLs
  // Cleanup preview URLs on unmount
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(() => () => {
    photosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
  }, []);

  return (
    <div className="space-y-6">
      {/* Stepper */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2 shrink-0">
            <div
              className={`w-7 h-7 rounded-full text-xs flex items-center justify-center font-medium ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className={`text-sm ${i === step ? "font-medium" : "text-muted-foreground"}`}>
              {s}
            </span>
            {i < STEPS.length - 1 && <div className="w-6 h-px bg-border" />}
          </div>
        ))}
      </div>

      {/* Step 0: Melder */}
      {step === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Naam *</Label>
            <Input
              value={form.reporter_name}
              onChange={(e) => upd("reporter_name", e.target.value)}
              required
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Functie</Label>
            <Input
              value={form.reporter_function}
              onChange={(e) => upd("reporter_function", e.target.value)}
              maxLength={120}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Datum</Label>
            <Input
              type="date"
              value={form.observed_date}
              onChange={(e) => upd("observed_date", e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tijdstip</Label>
            <Input
              type="time"
              value={form.observed_time}
              onChange={(e) => upd("observed_time", e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Step 1: Situatie */}
      {step === 1 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <Input
              value={form.location}
              onChange={(e) => upd("location", e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Betrokken firma / persoon</Label>
            <Input
              value={form.involved_party}
              onChange={(e) => upd("involved_party", e.target.value)}
              maxLength={200}
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label>Omschrijving situatie</Label>
            <Textarea
              rows={5}
              value={form.situation_description}
              onChange={(e) => upd("situation_description", e.target.value)}
              maxLength={2000}
              placeholder="Wat heb je waargenomen?"
            />
          </div>
        </div>
      )}

      {/* Step 2: Gevaar & Risico */}
      {step === 2 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="font-medium mb-2 text-sm uppercase tracking-wide text-muted-foreground">
              Gevaar {hazards.length > 0 && <Badge variant="secondary">{hazards.length}</Badge>}
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoeken..."
                value={hazardQuery}
                onChange={(e) => setHazardQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="border rounded-md p-3 max-h-72 overflow-y-auto space-y-2">
              {filteredHazards.map((h) => (
                <label key={h} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={hazards.includes(h)}
                    onCheckedChange={() => toggle(hazards, setHazards, h)}
                  />
                  {h}
                </label>
              ))}
              {!filteredHazards.length && (
                <p className="text-xs text-muted-foreground py-2">Geen resultaten</p>
              )}
            </div>
          </div>
          <div>
            <div className="font-medium mb-2 text-sm uppercase tracking-wide text-muted-foreground">
              Risico {risks.length > 0 && <Badge variant="secondary">{risks.length}</Badge>}
            </div>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoeken..."
                value={riskQuery}
                onChange={(e) => setRiskQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <div className="border rounded-md p-3 max-h-72 overflow-y-auto space-y-2">
              {filteredRisks.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={risks.includes(r)}
                    onCheckedChange={() => toggle(risks, setRisks, r)}
                  />
                  {r}
                </label>
              ))}
              {!filteredRisks.length && (
                <p className="text-xs text-muted-foreground py-2">Geen resultaten</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Acties */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Ondernomen actie</Label>
            <Textarea
              rows={3}
              value={form.action_taken}
              onChange={(e) => upd("action_taken", e.target.value)}
              maxLength={2000}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Voorstel tot verbetering</Label>
            <Textarea
              rows={3}
              value={form.improvement_proposal}
              onChange={(e) => upd("improvement_proposal", e.target.value)}
              maxLength={2000}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Actie van het bedrijf</Label>
            <Textarea
              rows={3}
              value={form.company_action}
              onChange={(e) => upd("company_action", e.target.value)}
              maxLength={2000}
            />
          </div>
        </div>
      )}

      {/* Step 4: Foto's */}
      {step === 4 && (
        <div className="space-y-4">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full h-24 border-dashed"
          >
            <Camera className="w-6 h-6" />
            <span className="ml-2">
              {uploading ? "Uploaden..." : "Foto('s) toevoegen"}
            </span>
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Optioneel. Foto's worden automatisch gecomprimeerd.
          </p>
          {photos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {photos.map((p) => (
                <div key={p.path} className="relative group rounded-md overflow-hidden border">
                  <img src={p.previewUrl} alt="" className="w-full h-32 object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(p.path)}
                    className="absolute top-1 right-1 bg-background/90 rounded-full p-1 opacity-0 group-hover:opacity-100 transition"
                    aria-label="Foto verwijderen"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Step 5: Ondertekening */}
      {step === 5 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Naam ondertekenaar</Label>
              <Input
                value={form.signer_name}
                onChange={(e) => upd("signer_name", e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Functie</Label>
              <Input
                value={form.signer_function}
                onChange={(e) => upd("signer_function", e.target.value)}
                maxLength={120}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Handtekening (optioneel)</Label>
            <div className="border-2 border-dashed border-muted-foreground/30 rounded-lg bg-white overflow-hidden touch-none">
              <SignatureCanvas
                ref={sigRef}
                canvasProps={{
                  className: "w-full h-48 md:h-56",
                  width: 800,
                  height: 260,
                }}
                onEnd={() => setSigEmpty(false)}
                penColor="#111111"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                sigRef.current?.clear();
                setSigEmpty(true);
              }}
            >
              <RotateCcw className="w-4 h-4" /> Wissen
            </Button>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-2 pt-4 border-t">
        <Button type="button" variant="ghost" onClick={onDone}>
          <X className="w-4 h-4" /> Annuleren
        </Button>
        <div className="flex gap-2">
          {step > 0 && (
            <Button type="button" variant="outline" onClick={prev}>
              <ArrowLeft className="w-4 h-4" /> Vorige
            </Button>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next} disabled={!canNext()}>
              Volgende <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => create.mutate()}
              disabled={create.isPending}
            >
              {create.isPending ? "Indienen..." : `${label.short} indienen`}
              {!create.isPending && <Check className="w-4 h-4" />}
            </Button>
          )}
        </div>
      </div>
      {sigEmpty === false && step === 5 && (
        <p className="text-xs text-muted-foreground">Handtekening geregistreerd.</p>
      )}
    </div>
  );
}
