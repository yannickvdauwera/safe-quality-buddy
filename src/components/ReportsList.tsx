import { useMemo, useState } from "react";
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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, MoreHorizontal, Trash2, Download, FileText, FileSpreadsheet, FileType, ArrowUpDown, ArrowUp, ArrowDown, Search, type LucideIcon } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { exportReportPdf, exportReportExcel, exportReportWord, type ReportExport } from "@/lib/reports-export";


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

function getSubjectName(r: { type: string; details?: unknown }): string | null {
  const d = (r.details ?? {}) as Record<string, unknown>;
  const h = (d.header ?? {}) as Record<string, unknown>;
  const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const candidates = [
    clean(h.observed_name),
    [clean(h.first_name), clean(h.last_name)].filter(Boolean).join(" "),
    [clean(h.last_name), clean(h.first_name)].filter(Boolean).join(" "),
    clean(d.victim_name),
    clean(d.submitter_name),
  ];
  return candidates.find((v) => v.length > 0) || null;
}

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
  /** Hide the status column and status-management actions (e.g. for inspections). */
  hideStatus?: boolean;
  /** Hide the severity column (e.g. for inspections). */
  hideSeverity?: boolean;
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
  hideStatus = false,
  hideSeverity = false,
}: ReportsListProps) {
  const { user, hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "hse_manager", "manager"]);
  const canDelete = hasAnyRole(["admin"]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<"all" | "mine" | "assigned">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [search, setSearch] = useState("");
  type SortKey = "date" | "subject" | "title" | "location" | "severity" | "status";
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");


  const allowedTypes = typeOptions.map((t) => t.value);

  const schema = z.object({
    type: z.string().refine((v) => allowedTypes.includes(v), "Kies een geldig type"),
    title: z.string().trim().min(3, "Titel is verplicht").max(200),
    description: z.string().trim().max(4000).optional().or(z.literal("")),
    location: z.string().trim().max(200).optional().or(z.literal("")),
    involved_firm: z.string().trim().max(200).optional().or(z.literal("")),
    severity: z.enum(["laag", "middel", "hoog", "kritiek"]).optional().default("middel"),
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

  const bulkUpdateStatus = async (status: string) => {
    if (selectedIds.size === 0) return;
    const payload: Record<string, unknown> = { status };
    if (status === "gesloten") payload.closed_at = new Date().toISOString();
    const { error } = await supabase
      .from("reports")
      .update(payload as never)
      .in("id", Array.from(selectedIds));
    if (error) return toast.error(error.message);
    toast.success(`${selectedIds.size} item(s) bijgewerkt`);
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: [queryKey] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    const { error } = await supabase
      .from("reports")
      .delete()
      .in("id", Array.from(selectedIds));
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success(`${selectedIds.size} item(s) verwijderd`);
    setSelectedIds(new Set());
    setConfirmDelete(false);
    queryClient.invalidateQueries({ queryKey: [queryKey] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };
  const allSelected = filtered.length > 0 && filtered.every((r) => selectedIds.has(r.id));
  const toggleAll = (checked: boolean) => {
    setSelectedIds(() => (checked ? new Set(filtered.map((r) => r.id)) : new Set()));
  };

  const showStatusActions = canManage && !hideStatus;
  const showSelect = canManage || canDelete;
  const colCount = 4 + (hideSeverity ? 0 : 1) + (hideStatus ? 0 : 1) + 1 + (showSelect ? 1 : 0);

  const handleExportPdf = async (r: unknown) => {
    try { await exportReportPdf(r as ReportExport); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Export mislukt"); }
  };
  const handleExportExcel = (r: unknown) => {
    try { exportReportExcel(r as ReportExport); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Export mislukt"); }
  };
  const handleExportWord = async (r: unknown) => {
    try { await exportReportWord(r as ReportExport); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Export mislukt"); }
  };

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

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">{selectedIds.size} geselecteerd</span>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Selectie wissen</Button>
          <div className="ml-auto flex flex-wrap gap-2">
            {canManage && !hideStatus && (
              <>
                <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus("in_behandeling")}>In behandeling</Button>
                <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus("opgevolgd")}>Opgevolgd</Button>
                <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus("gesloten")}>Sluiten</Button>
                <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus("open")}>Heropenen</Button>
              </>
            )}
            {canDelete && (
              <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-4 h-4" /> Verwijderen
              </Button>
            )}
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {showSelect && (
                    <TableHead className="w-10">
                      <Checkbox
                        checked={allSelected}
                        onCheckedChange={(c) => toggleAll(!!c)}
                        aria-label="Alles selecteren"
                      />
                    </TableHead>
                  )}
                  <TableHead>Datum</TableHead>
                  <TableHead>Medewerker</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>{locationLabel}</TableHead>
                  {!hideSeverity && <TableHead>Ernst</TableHead>}
                  {!hideStatus && <TableHead>Status</TableHead>}
                  <TableHead className="text-right">Export</TableHead>
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
                    {showSelect && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(r.id)}
                          onCheckedChange={(c) => toggleOne(r.id, !!c)}
                          aria-label="Rij selecteren"
                        />
                      </TableCell>
                    )}
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {new Date(r.observed_at).toLocaleDateString("nl-BE")}
                    </TableCell>
                    <TableCell>{getSubjectName(r) ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="font-medium">{r.title}</TableCell>
                    <TableCell className="text-muted-foreground">{r.location ?? "—"}</TableCell>
                    {!hideSeverity && <TableCell><Badge variant={severityVariant(r.severity)}>{SEVERITY_LABELS[r.severity]}</Badge></TableCell>}
                    {!hideStatus && <TableCell><Badge variant={statusVariant(r.status)}>{STATUS_LABELS[r.status]}</Badge></TableCell>}
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm"><Download className="w-4 h-4" /> Export</Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleExportPdf(r)}>
                              <FileText className="w-4 h-4" /> PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportWord(r)}>
                              <FileType className="w-4 h-4" /> Word (.docx)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleExportExcel(r)}>
                              <FileSpreadsheet className="w-4 h-4" /> Excel (.xlsx)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        {showStatusActions && (
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
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Definitief verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Je staat op het punt om <strong>{selectedIds.size}</strong> item(s) permanent te verwijderen.
              Deze actie kan niet ongedaan gemaakt worden en alle gekoppelde gegevens gaan verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); bulkDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Verwijderen…" : "Ja, definitief verwijderen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
