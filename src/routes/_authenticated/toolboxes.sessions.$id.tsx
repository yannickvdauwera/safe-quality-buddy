import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, QrCode, FileDown, PenLine, CheckCircle2, Copy } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { SESSION_STATUS_LABELS, type ToolboxContent } from "@/lib/toolbox-types";
import { SignaturePad } from "@/components/SignaturePad";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { exportSessionToPdf } from "@/lib/toolbox-pdf";

export const Route = createFileRoute("/_authenticated/toolboxes/sessions/$id")({
  component: SessionDetail,
});

function SessionDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [signingFor, setSigningFor] = useState<{ employeeId: string; name: string } | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: session, isLoading } = useQuery({
    queryKey: ["toolbox-session", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("toolbox_sessions")
        .select(`
          id, status, scheduled_at, given_at, location, notes, signing_token, given_by_employee_id,
          toolboxes(id, title, description, category),
          toolbox_versions(id, version_number, content),
          given_by:employees!toolbox_sessions_given_by_employee_id_fkey(id, full_name)
        `)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: participants } = useQuery({
    queryKey: ["session-participants", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("toolbox_session_participants")
        .select("employee_id, employees(id, full_name, function_title)")
        .eq("session_id", id);
      if (error) throw error;
      return data;
    },
  });

  const { data: signatures } = useQuery({
    queryKey: ["session-signatures", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("toolbox_signatures")
        .select("employee_id, signature_data, signed_at, sign_method")
        .eq("session_id", id);
      if (error) throw error;
      return data;
    },
  });

  const signaturesByEmp = new Map((signatures ?? []).map((s) => [s.employee_id, s]));

  const handleSign = async (dataUrl: string) => {
    if (!signingFor || !session) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("toolbox_signatures").insert({
        session_id: session.id,
        employee_id: signingFor.employeeId,
        signature_data: dataUrl,
        sign_method: "kiosk",
        signed_by_user_id: user?.id ?? null,
      });
      if (error) throw error;
      toast.success(`${signingFor.name} getekend`);
      setSigningFor(null);
      queryClient.invalidateQueries({ queryKey: ["session-signatures", id] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fout bij opslaan");
    } finally { setSaving(false); }
  };

  const updateStatus = async (status: "planned" | "in_progress" | "completed" | "cancelled") => {
    const patch: { status: typeof status; given_at?: string } = { status };
    if (status === "in_progress" || status === "completed") patch.given_at = new Date().toISOString();
    const { error } = await supabase.from("toolbox_sessions").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    queryClient.invalidateQueries({ queryKey: ["toolbox-session", id] });
  };

  const exportPdf = async () => {
    if (!session || !participants) return;
    const tb = session.toolboxes as unknown as { title: string; category: string | null };
    const ver = session.toolbox_versions as unknown as { version_number: number; content: ToolboxContent };
    const gb = session.given_by as unknown as { full_name: string } | null;
    const attendees = participants.map((p) => {
      const emp = p.employees as unknown as { full_name: string; function_title: string | null };
      const sig = signaturesByEmp.get(p.employee_id);
      return {
        employee_id: p.employee_id,
        full_name: emp.full_name,
        function_title: emp.function_title,
        signature_data: sig?.signature_data ?? null,
        signed_at: sig?.signed_at ?? null,
        sign_method: sig?.sign_method ?? null,
      };
    });
    await exportSessionToPdf({
      session_id: session.id,
      toolbox_title: tb.title,
      toolbox_category: tb.category,
      version_number: ver.version_number,
      scheduled_at: session.scheduled_at,
      given_at: session.given_at,
      location: session.location,
      given_by_name: gb?.full_name ?? null,
      notes: session.notes,
      content: ver.content,
      attendees,
    });
  };

  if (isLoading || !session) {
    return <AppShell><div className="text-sm text-muted-foreground">Laden...</div></AppShell>;
  }

  const tb = session.toolboxes as unknown as { id: string; title: string; category: string | null };
  const ver = session.toolbox_versions as unknown as { version_number: number; content: ToolboxContent };
  const gb = session.given_by as unknown as { full_name: string } | null;
  const publicSignUrl = `${window.location.origin}/sign/${session.signing_token}`;
  const signedCount = signaturesByEmp.size;
  const totalCount = participants?.length ?? 0;

  return (
    <AppShell>
      <div className="space-y-6 max-w-5xl">
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/toolboxes/$id", params: { id: tb.id } })}>
          <ArrowLeft className="w-4 h-4" /> Terug naar toolbox
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={session.status === "completed" ? "default" : "secondary"}>
                {SESSION_STATUS_LABELS[session.status]}
              </Badge>
              <span className="text-xs text-muted-foreground">Versie {ver.version_number}</span>
            </div>
            <h1 className="text-2xl font-bold">{tb.title}</h1>
            <div className="text-sm text-muted-foreground mt-1">
              {session.location && <>{session.location} · </>}
              {(session.given_at ?? session.scheduled_at) && new Date(session.given_at ?? session.scheduled_at!).toLocaleString("nl-BE")}
              {gb && <> · gegeven door {gb.full_name}</>}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="outline" onClick={() => setQrOpen(true)}><QrCode className="w-4 h-4" /> QR-code</Button>
            <Button variant="outline" onClick={exportPdf}><FileDown className="w-4 h-4" /> Export PDF</Button>
          </div>
        </div>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold">Deelnemers & handtekeningen</div>
              <div className="text-sm text-muted-foreground">{signedCount} van {totalCount} getekend</div>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Status:</Label>
              <Select value={session.status} onValueChange={updateStatus}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Gepland</SelectItem>
                  <SelectItem value="in_progress">Bezig</SelectItem>
                  <SelectItem value="completed">Afgerond</SelectItem>
                  <SelectItem value="cancelled">Geannuleerd</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="divide-y">
            {(participants ?? []).map((p) => {
              const emp = p.employees as unknown as { full_name: string; function_title: string | null };
              const sig = signaturesByEmp.get(p.employee_id);
              return (
                <div key={p.employee_id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{emp.full_name}</div>
                    <div className="text-xs text-muted-foreground">{emp.function_title ?? "—"}</div>
                  </div>
                  {sig ? (
                    <div className="flex items-center gap-3">
                      <img src={sig.signature_data} alt="handtekening" className="h-10 border rounded bg-white" />
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">{new Date(sig.signed_at).toLocaleString("nl-BE")}</div>
                        <div className="text-[10px] text-muted-foreground uppercase">{sig.sign_method}</div>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setSigningFor({ employeeId: p.employee_id, name: emp.full_name })}>
                      <PenLine className="w-4 h-4" /> Tekenen
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="font-semibold mb-3">Toolbox-inhoud</div>
          <ContentView content={ver.content} />
        </Card>
      </div>

      <Dialog open={!!signingFor} onOpenChange={(o) => !o && setSigningFor(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Handtekening — {signingFor?.name}</DialogTitle></DialogHeader>
          <SignaturePad onSave={handleSign} saving={saving} />
        </DialogContent>
      </Dialog>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>QR-code voor aftekenen</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded">
              <QRCodeCanvas value={publicSignUrl} size={220} />
            </div>
            <p className="text-xs text-muted-foreground text-center max-w-sm">
              Deelnemers scannen deze code met hun telefoon, kiezen hun naam en tekenen.
            </p>
            <div className="w-full flex items-center gap-2">
              <input readOnly value={publicSignUrl} className="flex-1 text-xs border rounded px-2 py-1 bg-muted" />
              <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(publicSignUrl); toast.success("Link gekopieerd"); }}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
