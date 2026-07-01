import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Plus, FileText, FileSpreadsheet, FileType, Link as LinkIcon, Camera, PenLine } from "lucide-react";
import { toast } from "sonner";
import { SafetyObservationWizard } from "./SafetyObservationWizard";
import { TYPE_LABELS, type SafetyObservationType } from "@/lib/safety-observations";
import {
  exportToPdf, exportToDocx, exportToXlsx, type ObservationExport,
} from "@/lib/safety-observations-export";

export function SafetyObservationsPage({ type }: { type: SafetyObservationType }) {
  const [open, setOpen] = useState(false);
  const label = TYPE_LABELS[type];

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

      <Card className="p-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Datum</TableHead>
              <TableHead>Melder</TableHead>
              <TableHead>Plant / Locatie</TableHead>
              <TableHead>Gevaren</TableHead>
              <TableHead className="w-24">Extra</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Export</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Laden…</TableCell></TableRow>
            ) : data.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nog geen meldingen.</TableCell></TableRow>
            ) : (
              data.map((o) => (
                <TableRow key={o.id}>
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
                  <TableCell className="text-right">
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
      </Card>
    </div>
  );
}

