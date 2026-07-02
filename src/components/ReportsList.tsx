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
import { Plus, MoreHorizontal, type LucideIcon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";

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

export interface ReportsListProps {
  queryKey: string;
  title: string;
  description: string;
  newLabel: string;
  singularNoun: string; // "melding" | "inspectie"
  icon: LucideIcon;
  typeOptions: { value: string; label: string }[];
  defaultType: string;
  showInvolvedFirm?: boolean;
  locationLabel?: string;
  /** Optional custom form component rendered inside the "New" dialog. */
  CreateFormComponent?: React.ComponentType<{
    onClose: () => void;
    onCreated: () => void;
    typeOptions: { value: string; label: string }[];
    defaultType: string;
  }>;
  /** Extra action buttons rendered next to the "New" button (e.g. Import). */
  extraActions?: React.ReactNode;
}

export function ReportsList({
  queryKey,
  title,
  description,
  newLabel,
  singularNoun,
  icon: Icon,
  typeOptions,
  defaultType,
  showInvolvedFirm = true,
  locationLabel = "Locatie",
  CreateFormComponent,
  extraActions,
}: ReportsListProps) {
  const { user, hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "hse_manager", "manager"]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "mine" | "assigned">("all");


  const allowedTypes = typeOptions.map((t) => t.value);

  const schema = z.object({
    type: z.string().refine((v) => allowedTypes.includes(v), "Kies een geldig type"),
    title: z.string().trim().min(3, "Titel is verplicht").max(200),
    description: z.string().trim().max(4000).optional().or(z.literal("")),
    location: z.string().trim().max(200).optional().or(z.literal("")),
    involved_firm: z.string().trim().max(200).optional().or(z.literal("")),
    severity: z.enum(["laag", "middel", "hoog", "kritiek"]),
  });

  const { data: reports = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .in("type", allowedTypes as never)
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
    toast.success(`${singularNoun[0].toUpperCase() + singularNoun.slice(1)} aangemaakt`);
    setOpen(false);
    queryClient.invalidateQueries({ queryKey: [queryKey] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
  };

  const updateStatus = async (id: string, status: string) => {
    const payload: Record<string, unknown> = { status };
    if (status === "gesloten") payload.closed_at = new Date().toISOString();
    const { error } = await supabase.from("reports").update(payload as never).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Status bijgewerkt");
    queryClient.invalidateQueries({ queryKey: [queryKey] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
  };

  const colCount = canManage ? 7 : 6;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {extraActions}
          <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4" /> {newLabel}</Button>
          </DialogTrigger>
          <DialogContent className={CreateFormComponent ? "max-w-2xl max-h-[90vh] overflow-y-auto" : "max-w-lg"}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Icon className="w-5 h-5" /> {newLabel}</DialogTitle>
              <DialogDescription>Registreer een nieuwe {singularNoun}.</DialogDescription>
            </DialogHeader>
            {CreateFormComponent ? (
              <CreateFormComponent
                onClose={() => setOpen(false)}
                onCreated={() => {
                  setOpen(false);
                  queryClient.invalidateQueries({ queryKey: [queryKey] });
                  queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
                }}
                typeOptions={typeOptions}
                defaultType={defaultType}
              />
            ) : (
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="type">Type *</Label>
                    <Select name="type" defaultValue={defaultType} required>
                      <SelectTrigger id="type"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {typeOptions.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
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
                  <Textarea id="description" name="description" rows={4} maxLength={4000} placeholder="Wat is er vastgesteld? Waar? Waarom?" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="location">{locationLabel}</Label>
                    <Input id="location" name="location" maxLength={200} placeholder="Plant / afdeling / zone" />
                  </div>
                  {showInvolvedFirm && (
                    <div className="space-y-1.5">
                      <Label htmlFor="involved_firm">Betrokken firma</Label>
                      <Input id="involved_firm" name="involved_firm" maxLength={200} />
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
                  <Button type="submit" disabled={saving}>Registreren</Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>

          </Dialog>
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant={filter === "all" ? "default" : "outline"} size="sm" onClick={() => setFilter("all")}>
          Alle ({reports.length})
        </Button>
        <Button variant={filter === "mine" ? "default" : "outline"} size="sm" onClick={() => setFilter("mine")}>
          Van mij ({reports.filter((r) => r.reporter_id === user?.id).length})
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
                  <TableHead>{locationLabel}</TableHead>
                  <TableHead>Ernst</TableHead>
                  <TableHead>Status</TableHead>
                  {canManage && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={colCount} className="text-center text-muted-foreground py-8">Laden…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={colCount} className="text-center text-muted-foreground py-12">
                    Nog geen items in deze weergave.
                  </TableCell></TableRow>
                ) : filtered.map((r) => (
                  <TableRow
                    key={r.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      const isInspection = r.type === "werkplekinspectie" || r.type === "kwaliteitscontrole";
                      navigate({
                        to: isInspection ? "/inspecties/$id" : "/meldingen/$id",
                        params: { id: r.id },
                      });
                    }}
                  >
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {new Date(r.observed_at).toLocaleDateString("nl-BE")}
                    </TableCell>
                    <TableCell><Badge variant="outline">{typeOptions.find((t) => t.value === r.type)?.label ?? r.type}</Badge></TableCell>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell className="text-muted-foreground">{r.location ?? "—"}</TableCell>
                    <TableCell><Badge variant={severityVariant(r.severity)}>{SEVERITY_LABELS[r.severity]}</Badge></TableCell>
                    <TableCell><Badge variant={statusVariant(r.status)}>{STATUS_LABELS[r.status]}</Badge></TableCell>
                    {canManage && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
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
