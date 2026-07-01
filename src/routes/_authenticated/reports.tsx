import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, AlertTriangle, MoreHorizontal } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Meldingen — HSE & Kwaliteit" }] }),
  component: ReportsPage,
});

export const REPORT_TYPES = [
  { value: "mos", label: "MOS-melding" },
  { value: "stop", label: "STOP-melding" },
  { value: "ao_ehbo", label: "Arbeidsongeval / EHBO" },
  { value: "werkplekinspectie", label: "Werkplekinspectie" },
  { value: "kwaliteit", label: "Kwaliteitscontrole" },
  { value: "klacht", label: "Klacht" },
  { value: "andere", label: "Andere" },
] as const;

export const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_behandeling: "In behandeling",
  opgevolgd: "Opgevolgd",
  gesloten: "Gesloten",
};

export const SEVERITY_LABELS: Record<string, string> = {
  laag: "Laag",
  middel: "Middel",
  hoog: "Hoog",
  kritiek: "Kritiek",
};

const statusVariant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
  s === "open" ? "destructive" : s === "in_behandeling" ? "default" : s === "opgevolgd" ? "secondary" : "outline";

const severityVariant = (s: string): "default" | "secondary" | "destructive" | "outline" =>
  s === "kritiek" ? "destructive" : s === "hoog" ? "default" : s === "middel" ? "secondary" : "outline";

const schema = z.object({
  type: z.enum(["mos", "stop", "ao_ehbo", "werkplekinspectie", "kwaliteit", "klacht", "andere"]),
  title: z.string().trim().min(3, "Titel is verplicht").max(200),
  description: z.string().trim().max(4000).optional().or(z.literal("")),
  location: z.string().trim().max(200).optional().or(z.literal("")),
  involved_firm: z.string().trim().max(200).optional().or(z.literal("")),
  severity: z.enum(["laag", "middel", "hoog", "kritiek"]),
});

function ReportsPage() {
  const { user, hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "hse_manager", "manager"]);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "mine" | "assigned">("all");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("observed_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = reports.filter((r) => {
    if (filter === "mine") return r.reporter_id === user?.id;
    if (filter === "assigned") return r.assigned_to === user?.id;
    return true;
  });

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const parsed = schema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setSaving(true);
    const payload = {
      ...parsed.data,
      description: parsed.data.description || null,
      location: parsed.data.location || null,
      involved_firm: parsed.data.involved_firm || null,
      reporter_id: user.id,
    };
    const { error } = await supabase.from("reports").insert(payload as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Melding aangemaakt");
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
  };

  const updateStatus = async (id: string, status: string) => {
    const payload: Record<string, unknown> = { status };
    if (status === "gesloten") payload.closed_at = new Date().toISOString();
    const { error } = await supabase.from("reports").update(payload as never).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status bijgewerkt");
    queryClient.invalidateQueries({ queryKey: ["reports"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Meldingen & inspecties</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Interne meldingen (MOS, STOP, AO/EHBO, kwaliteit, …). Voeg je vaststelling toe, HSE of leidinggevende volgt op.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4" /> Nieuwe melding</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Nieuwe melding</DialogTitle>
              <DialogDescription>Registreer een vaststelling, incident of controle.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="type">Type *</Label>
                  <Select name="type" defaultValue="mos" required>
                    <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {REPORT_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="severity">Ernst *</Label>
                  <Select name="severity" defaultValue="middel" required>
                    <SelectTrigger id="severity"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="laag">Laag</SelectItem>
                      <SelectItem value="middel">Middel</SelectItem>
                      <SelectItem value="hoog">Hoog</SelectItem>
                      <SelectItem value="kritiek">Kritiek</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="title">Titel *</Label>
                <Input id="title" name="title" required maxLength={200} placeholder="Korte samenvatting" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Beschrijving</Label>
                <Textarea id="description" name="description" rows={4} maxLength={4000} placeholder="Wat is er gebeurd? Hoe? Waarom?" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="location">Locatie</Label>
                  <Input id="location" name="location" maxLength={200} placeholder="Plant / afdeling / zone" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="involved_firm">Betrokken firma</Label>
                  <Input id="involved_firm" name="involved_firm" maxLength={200} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
                <Button type="submit" disabled={saving}>Registreren</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>Alle ({reports.length})</Button>
        <Button variant={filter === "mine" ? "default" : "outline"} size="sm" onClick={() => setFilter("mine")}>
          Mijn meldingen ({reports.filter((r) => r.reporter_id === user?.id).length})
        </Button>
        {canManage && (
          <Button variant={filter === "assigned" ? "default" : "outline"} size="sm" onClick={() => setFilter("assigned")}>
            Toegewezen aan mij ({reports.filter((r) => r.assigned_to === user?.id).length})
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Locatie</TableHead>
                  <TableHead>Ernst</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={canManage ? 7 : 6} className="text-center text-muted-foreground py-8">Laden…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={canManage ? 7 : 6} className="text-center text-muted-foreground py-12">
                    Nog geen meldingen in deze weergave.
                  </TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {new Date(r.observed_at).toLocaleDateString("nl-BE")}
                    </TableCell>
                    <TableCell><Badge variant="outline">{REPORT_TYPES.find((t) => t.value === r.type)?.label ?? r.type}</Badge></TableCell>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell className="text-muted-foreground">{r.location ?? "—"}</TableCell>
                    <TableCell><Badge variant={severityVariant(r.severity)}>{SEVERITY_LABELS[r.severity]}</Badge></TableCell>
                    <TableCell><Badge variant={statusVariant(r.status)}>{STATUS_LABELS[r.status]}</Badge></TableCell>
                    {canManage && (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="w-8 h-8"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => updateStatus(r.id, "in_behandeling")}>In behandeling nemen</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(r.id, "opgevolgd")}>Markeren als opgevolgd</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(r.id, "gesloten")}>Sluiten</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => updateStatus(r.id, "open")}>Heropenen</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
