import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Plus, FileText, FileSpreadsheet, FileType, Link as LinkIcon, Camera, PenLine, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SafetyObservationWizard } from "./SafetyObservationWizard";
import { TYPE_LABELS, type SafetyObservationType } from "@/lib/safety-observations";
import {
  exportToPdf, exportToDocx, exportToXlsx, type ObservationExport,
} from "@/lib/safety-observations-export";

export function SafetyObservationsPage({ type }: { type: SafetyObservationType }) {
  const [open, setOpen] = useState(false);
  const label = TYPE_LABELS[type];
  const { hasAnyRole } = useAuth();
  const canDelete = hasAnyRole(["admin"]);
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["safety_observations", type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("safety_observations")
        .select("*")
        .eq("type", type)
        .order("observed_date", { ascending: false });
      if (error) throw error;
      return data as ObservationExport[];
    },
  });

  const copyPublicLink = async () => {
    const url = `${window.location.origin}/report/${type}`;
    await navigator.clipboard.writeText(url);
    toast.success("Publieke link gekopieerd", {
      description: "Deel deze via QR of e-mail. Werkt zonder login.",
    });
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    const { error } = await supabase
      .from("safety_observations")
      .delete()
      .in("id", Array.from(selectedIds));
    setDeleting(false);
    if (error) return toast.error(error.message);
    toast.success(`${selectedIds.size} melding(en) verwijderd`);
    setSelectedIds(new Set());
    setConfirmDelete(false);
    queryClient.invalidateQueries({ queryKey: ["safety_observations", type] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-metrics"] });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };
  const allSelected = data.length > 0 && data.every((o) => selectedIds.has(o.id));
  const toggleAll = (checked: boolean) => {
    setSelectedIds(() => (checked ? new Set(data.map((o) => o.id)) : new Set()));
  };
  const colCount = 7 + (canDelete ? 1 : 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{label.title}en</h1>
          <p className="text-sm text-muted-foreground">
            {type === "mos"
              ? "Meldingen Onveilige Situaties — registratie en opvolging."
              : "STOP-reflex meldingen — direct ingrijpen bij onveilig gedrag of situatie."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={copyPublicLink}>
            <LinkIcon className="w-4 h-4" /> Publieke link
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4" /> Nieuwe {label.short}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nieuwe {label.title}</DialogTitle>
              </DialogHeader>
              <SafetyObservationWizard type={type} onDone={() => setOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {canDelete && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium">{selectedIds.size} geselecteerd</span>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Selectie wissen</Button>
          <div className="ml-auto">
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="w-4 h-4" /> Verwijderen
            </Button>
          </div>
        </div>
      )}

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {canDelete && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(c) => toggleAll(!!c)}
                    aria-label="Alles selecteren"
                  />
                </TableHead>
              )}
              <TableHead>Datum</TableHead>
              <TableHead>Melder</TableHead>
              <TableHead>Plant / Locatie</TableHead>
              <TableHead>Gevaren</TableHead>
              <TableHead className="w-24">Extra</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right whitespace-nowrap">Export</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={colCount} className="text-center py-8 text-muted-foreground">Laden…</TableCell></TableRow>
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={colCount} className="text-center py-8 text-muted-foreground">Nog geen meldingen.</TableCell></TableRow>
            ) : (
              data.map((o) => (
                <TableRow key={o.id}>
                  {canDelete && (
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(o.id)}
                        onCheckedChange={(c) => toggleOne(o.id, !!c)}
                        aria-label="Rij selecteren"
                      />
                    </TableCell>
                  )}
                  <TableCell className="whitespace-nowrap">
                    {o.observed_date}{o.observed_time ? ` ${o.observed_time.slice(0, 5)}` : ""}
                  </TableCell>
                  <TableCell>{o.reporter_name}</TableCell>
                  <TableCell className="text-sm">
                    {[o.plant, o.area, o.location].filter(Boolean).join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm max-w-xs truncate">
                    {o.hazards.length ? o.hazards.join(", ") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1 text-muted-foreground">
                      {o.photos?.length ? (
                        <span className="inline-flex items-center gap-0.5 text-xs">
                          <Camera className="w-3.5 h-3.5" /> {o.photos.length}
                        </span>
                      ) : null}
                      {o.signature_data_url ? <PenLine className="w-3.5 h-3.5" /> : null}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{o.status}</Badge></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm"><Download className="w-4 h-4" /> Export</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => exportToPdf(o)}>
                          <FileText className="w-4 h-4" /> PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportToDocx(o)}>
                          <FileType className="w-4 h-4" /> Word (.docx)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => exportToXlsx(o)}>
                          <FileSpreadsheet className="w-4 h-4" /> Excel (.xlsx)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </Card>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Definitief verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Je staat op het punt om <strong>{selectedIds.size}</strong> melding(en) permanent te verwijderen.
              Deze actie kan niet ongedaan gemaakt worden en alle gekoppelde gegevens (foto's, handtekeningen) gaan verloren.
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

