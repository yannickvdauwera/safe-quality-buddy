import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, PenLine, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { SignaturePad } from "@/components/SignaturePad";
import { toast } from "sonner";

export const Route = createFileRoute("/sign/$token")({
  component: PublicSignPage,
});

interface PublicSessionData {
  session: { id: string; toolbox_id: string; status: string; location: string | null; scheduled_at: string | null; given_at: string | null };
  toolbox: { title: string; description: string | null; category: string | null };
  version: { version_number: number; content: { objective?: string; hazards?: string[]; measures?: string[]; checklist?: string[]; questions?: string[] } };
  participants: Array<{ employee_id: string; full_name: string; function_title: string | null; signed: boolean }>;
}

function PublicSignPage() {
  const { token } = Route.useParams();
  const queryClient = useQueryClient();
  const [signingFor, setSigningFor] = useState<{ employeeId: string; name: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [contentOpen, setContentOpen] = useState(false);

  const { data, isLoading, error } = useQuery<PublicSessionData>({
    queryKey: ["public-sign", token],
    queryFn: async () => {
      const res = await fetch(`/api/public/toolbox-sign?token=${encodeURIComponent(token)}`);
      if (!res.ok) throw new Error("Onbekende of verlopen link");
      return res.json();
    },
  });

  const handleSign = async (dataUrl: string) => {
    if (!signingFor) return;
    setSaving(true);
    try {
      const res = await fetch("/api/public/toolbox-sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, employee_id: signingFor.employeeId, signature_data: dataUrl }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Fout");
      toast.success(`Bedankt ${signingFor.name}!`);
      setSigningFor(null);
      queryClient.invalidateQueries({ queryKey: ["public-sign", token] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fout bij opslaan");
    } finally { setSaving(false); }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Laden...</div>;
  if (error || !data) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <Card className="p-8 text-center max-w-sm">
        <div className="text-destructive font-semibold mb-2">Link niet geldig</div>
        <p className="text-sm text-muted-foreground">Deze aftekenlink is onbekend of verlopen. Vraag de HSE-verantwoordelijke om een nieuwe code.</p>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-[#E30613] text-white">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6" />
          <div>
            <div className="font-bold">TSA Safety Services</div>
            <div className="text-xs opacity-90">Toolbox aftekenen</div>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Card className="p-4">
          <Badge variant="outline" className="mb-2">{data.toolbox.category ?? "Toolbox"}</Badge>
          <h1 className="text-xl font-bold">{data.toolbox.title}</h1>
          {data.toolbox.description && <p className="text-sm text-muted-foreground mt-1">{data.toolbox.description}</p>}
          <div className="text-xs text-muted-foreground mt-2">
            Versie {data.version.version_number}
            {data.session.location && ` · ${data.session.location}`}
          </div>
          <Button variant="link" className="p-0 h-auto mt-2 text-sm" onClick={() => setContentOpen(true)}>
            Bekijk inhoud toolbox →
          </Button>
        </Card>

        <Card className="p-4">
          <div className="font-semibold mb-3">Kies je naam om te tekenen</div>
          <div className="divide-y -mx-4">
            {data.participants.map((p) => (
              <div key={p.employee_id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{p.full_name}</div>
                  {p.function_title && <div className="text-xs text-muted-foreground">{p.function_title}</div>}
                </div>
                {p.signed ? (
                  <div className="flex items-center gap-1 text-green-600 text-sm">
                    <CheckCircle2 className="w-4 h-4" /> Getekend
                  </div>
                ) : (
                  <Button size="sm" onClick={() => setSigningFor({ employeeId: p.employee_id, name: p.full_name })}>
                    <PenLine className="w-4 h-4" /> Tekenen
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Dialog open={!!signingFor} onOpenChange={(o) => !o && setSigningFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Handtekening — {signingFor?.name}</DialogTitle></DialogHeader>
          <SignaturePad onSave={handleSign} saving={saving} />
        </DialogContent>
      </Dialog>

      <Dialog open={contentOpen} onOpenChange={setContentOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{data.toolbox.title}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {data.version.content.objective && (
              <div>
                <div className="font-medium text-sm mb-1">Doelstelling</div>
                <p className="text-sm text-muted-foreground">{data.version.content.objective}</p>
              </div>
            )}
            {(["hazards", "measures", "checklist", "questions"] as const).map((k) => {
              const labels = { hazards: "Gevaren", measures: "Preventiemaatregelen", checklist: "Checklist", questions: "Discussievragen" };
              const items = data.version.content[k];
              if (!items?.length) return null;
              return (
                <div key={k}>
                  <div className="font-medium text-sm mb-1">{labels[k]}</div>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {items.map((i, idx) => <li key={idx}>{i}</li>)}
                  </ul>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
