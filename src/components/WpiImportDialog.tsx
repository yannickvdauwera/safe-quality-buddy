import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import {
  readSheetAsMatrix, findHeaderRow, matrixToRecords, splitFullName, cellString,
  nameKey, parseDateCell,
} from "@/lib/import-utils";
import { WPI_CONFIG } from "@/components/inspection-configs";

/** Map an OK/NOK/NVT-ish cell value to the canonical answer. */
function normalizeAnswer(v: unknown): "ok" | "nok" | "nvt" | null {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  if (s.includes("nok")) return "nok";
  if (s.includes("nvt") || s === "n.v.t." || s === "n/a") return "nvt";
  if (s.includes("ok")) return "ok";
  return null;
}

interface RowResult {
  row: number;
  name: string;
  matched: boolean;
  employeeId?: string;
  newEmployee?: boolean;
  worksite: string;
  date: string | null;
  answers: Record<string, "ok" | "nok" | "nvt">;
  header: Record<string, string>;
  extras: Record<string, string>;
  signature: string | null;
}

export function WpiImportDialog() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<RowResult[]>([]);
  const [autoCreate, setAutoCreate] = useState(true);

  const allQuestionKeys = WPI_CONFIG.sections.flatMap((s) => s.questions.map((q) => ({ key: q.key, label: q.label })));

  const handleFile = async (file: File) => {
    setParsing(true);
    setFileName(file.name);
    try {
      const matrix = await readSheetAsMatrix(file);
      const headerRow = findHeaderRow(matrix, "Name");
      const records = matrixToRecords(matrix, headerRow);

      // Match column headers to WPI question labels (contains-based)
      const headers = Object.keys(records[0] ?? {});
      const questionColMap = new Map<string, string>(); // qKey -> col header
      allQuestionKeys.forEach((q) => {
        const numMatch = q.label.match(/^([A-C]\.?\d+\.?)/);
        const numPrefix = numMatch ? numMatch[1].toLowerCase() : "";
        const col = headers.find((h) => {
          const hl = h.toLowerCase();
          return numPrefix && hl.startsWith(numPrefix);
        });
        if (col) questionColMap.set(q.key, col);
      });

      // Preload all employees for name matching
      const { data: employees = [] } = await supabase
        .from("employees")
        .select("id, first_name, last_name");
      const empMap = new Map<string, string>();
      employees?.forEach((e) => {
        empMap.set(nameKey(`${e.first_name ?? ""} ${e.last_name ?? ""}`), e.id);
      });

      const findCol = (aliases: string[]) => {
        return headers.find((h) => aliases.some((a) => h.toLowerCase().includes(a)));
      };
      const nameCol = findCol(["name", "naam"]) ?? "Name";
      const functionCol = findCol(["functie geobserveerde", "functie"]) ?? "";
      const employerCol = findCol(["werkgever"]) ?? "";
      const signatureCol = findCol(["handtekening"]) ?? "";
      const principalCol = findCol(["opdrachtgever"]) ?? "";
      const worksiteCol = findCol(["werflocatie", "locatie", "werf"]) ?? "";
      const dateCol = findCol(["tijdstip", "datum"]) ?? "";
      const executorCol = findCol(["uitvoerder"]) ?? "";
      const nokDetailsCol = findCol(["duiding", "nok aangevinkte"]) ?? "";
      const otherCol = findCol(["andere opmerking", "overige"]) ?? "";
      const positiveCol = findCol(["positieve"]) ?? "";

      const parsed: RowResult[] = records.map((rec, idx) => {
        const name = cellString(rec[nameCol]);
        const answers: Record<string, "ok" | "nok" | "nvt"> = {};
        questionColMap.forEach((col, qKey) => {
          const a = normalizeAnswer(rec[col]);
          if (a) answers[qKey] = a;
        });
        const header: Record<string, string> = {
          observed_name: name,
          observed_function: functionCol ? cellString(rec[functionCol]) : "",
          employer: employerCol ? cellString(rec[employerCol]) : "",
          principal: principalCol ? cellString(rec[principalCol]) : "",
          worksite: worksiteCol ? cellString(rec[worksiteCol]) : "",
          executor: executorCol ? cellString(rec[executorCol]) : "",
        };
        const dateIso = dateCol ? parseDateCell(rec[dateCol]) : null;
        if (dateIso) header.date = dateIso.slice(0, 16);

        const extras: Record<string, string> = {};
        if (nokDetailsCol) extras.nok_details = cellString(rec[nokDetailsCol]);
        if (otherCol) extras.other_findings = cellString(rec[otherCol]);
        if (positiveCol) extras.positive_findings = cellString(rec[positiveCol]);

        const eid = empMap.get(nameKey(name));
        return {
          row: idx + 2,
          name,
          matched: !!eid,
          employeeId: eid,
          worksite: header.worksite,
          date: dateIso,
          answers,
          header,
          extras,
          signature: signatureCol ? cellString(rec[signatureCol]) || null : null,
        };
      });
      setRows(parsed);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Excel kon niet gelezen worden");
    } finally {
      setParsing(false);
    }
  };

  const doImport = async () => {
    if (!user) return toast.error("Niet ingelogd");
    if (rows.length === 0) return;
    setImporting(true);

    // 1) Auto-create missing employees if enabled
    const workingRows = [...rows];
    if (autoCreate) {
      const missing = workingRows.filter((r) => !r.matched && r.name);
      const uniqueByKey = new Map<string, { name: string; employer: string; func: string }>();
      missing.forEach((r) => {
        const k = nameKey(r.name);
        if (!k || uniqueByKey.has(k)) return;
        uniqueByKey.set(k, {
          name: r.name,
          employer: r.header.employer,
          func: r.header.observed_function,
        });
      });
      if (uniqueByKey.size > 0) {
        const toCreate = Array.from(uniqueByKey.values()).map((e) => {
          const { first, last } = splitFullName(e.name);
          return {
            first_name: first || "—",
            last_name: last || "—",
            employer: e.employer || null,
            function_title: e.func || null,
            active: false,
            notes: "Automatisch aangemaakt via WPI-import",
          };
        });
        const { data: created, error } = await supabase
          .from("employees")
          .insert(toCreate as never)
          .select("id, first_name, last_name");
        if (error) {
          setImporting(false);
          return toast.error(`Aanmaken medewerkers mislukt: ${error.message}`);
        }
        const createdMap = new Map<string, string>();
        created?.forEach((c) => createdMap.set(nameKey(`${c.first_name} ${c.last_name}`), c.id));
        workingRows.forEach((r) => {
          if (!r.matched) {
            const eid = createdMap.get(nameKey(r.name));
            if (eid) { r.employeeId = eid; r.matched = true; r.newEmployee = true; }
          }
        });
      }
    }

    // 2) Build report payloads
    const totalQ = allQuestionKeys.length;
    const payloads = workingRows.map((r) => {
      const answered = Object.keys(r.answers).length;
      const nokCount = Object.values(r.answers).filter((v) => v === "nok").length;
      const severity = nokCount === 0 ? "laag" : nokCount <= 2 ? "middel" : nokCount <= 5 ? "hoog" : "kritiek";
      const headerToStore: Record<string, string> = { ...r.header };
      if (r.employeeId) headerToStore.subject_employee_id = r.employeeId;
      const title = `WPI — ${r.name || "geobserveerde"}${r.worksite ? ` @ ${r.worksite}` : ""}`.slice(0, 200);
      return {
        type: "werkplekinspectie",
        severity,
        title,
        description: null,
        location: r.worksite || null,
        involved_firm: r.header.employer || null,
        reporter_id: user.id,
        observed_at: r.date ?? new Date().toISOString(),
        status: "gesloten",
        details: {
          header: headerToStore,
          answers: r.answers,
          extras: r.extras,
          signature: r.signature,
          stats: { total: totalQ, answered, nok: nokCount },
          imported: true,
        },
      };
    });

    // 3) Insert reports in chunks
    let inserted = 0;
    for (let i = 0; i < payloads.length; i += 100) {
      const chunk = payloads.slice(i, i + 100);
      const { error } = await supabase.from("reports").insert(chunk as never);
      if (error) {
        setImporting(false);
        return toast.error(`Import gefaald bij rij ${i}: ${error.message}`);
      }
      inserted += chunk.length;
    }

    setImporting(false);
    toast.success(`${inserted} WPI's geïmporteerd`);
    qc.invalidateQueries({ queryKey: ["reports-wpi"] });
    qc.invalidateQueries({ queryKey: ["employees"] });
    qc.invalidateQueries({ queryKey: ["dashboard-metrics"] });
    setOpen(false);
    setRows([]);
    setFileName("");
  };

  const matched = rows.filter((r) => r.matched).length;
  const unmatched = rows.length - matched;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setRows([]); setFileName(""); } }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="w-4 h-4" /> Importeer Excel</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" /> WPI-historiek importeren
          </DialogTitle>
          <DialogDescription>
            Herkent Monday-exportkolommen (Name, A.1 – C.22, Werflocatie, Tijdstip, …) en koppelt automatisch aan
            personeelsfiches op basis van naam.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground" />
            <label className="cursor-pointer">
              <span className="text-sm font-medium underline">Kies een .xlsx bestand</span>
              <input type="file" accept=".xlsx,.xls" className="hidden" disabled={parsing}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); }} />
            </label>
            <p className="text-xs text-muted-foreground">{parsing ? "Bezig met inlezen…" : "Enkel de eerste tab wordt verwerkt."}</p>
          </div>
        ) : (
          <>
            <Alert>
              <AlertDescription className="text-sm">
                <b>{fileName}</b> — {rows.length} WPI-rijen: <b className="text-emerald-600">{matched}</b> gekoppeld,
                {" "}<b className={unmatched ? "text-amber-600" : ""}>{unmatched}</b> nog niet gekoppeld.
              </AlertDescription>
            </Alert>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={autoCreate} onChange={(e) => setAutoCreate(e.target.checked)} />
              Onbekende namen automatisch aanmaken als <b>inactieve</b> personeelsfiche
            </label>
            <div className="border rounded-md max-h-[45vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Naam</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Werflocatie</TableHead>
                    <TableHead>Antw.</TableHead>
                    <TableHead>NOK</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 500).map((r) => {
                    const answered = Object.keys(r.answers).length;
                    const nok = Object.values(r.answers).filter((v) => v === "nok").length;
                    return (
                      <TableRow key={r.row}>
                        <TableCell className="text-xs text-muted-foreground">{r.row}</TableCell>
                        <TableCell className="text-sm">{r.name || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {r.matched
                            ? <span className="text-emerald-600 font-medium">✓ Gekoppeld</span>
                            : autoCreate
                              ? <span className="text-amber-600">Nieuw wordt aangemaakt</span>
                              : <span className="text-destructive">Niet gevonden</span>}
                        </TableCell>
                        <TableCell className="text-xs">{r.date ? new Date(r.date).toLocaleDateString("nl-BE") : "—"}</TableCell>
                        <TableCell className="text-xs">{r.worksite || "—"}</TableCell>
                        <TableCell className="text-xs">{answered}</TableCell>
                        <TableCell className={`text-xs ${nok > 0 ? "text-destructive font-medium" : ""}`}>{nok}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {rows.length > 500 && (
                <p className="text-xs text-center text-muted-foreground py-2">
                  Voorbeeld beperkt tot 500 rijen — alle {rows.length} worden geïmporteerd.
                </p>
              )}
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
          <Button onClick={doImport} disabled={importing || rows.length === 0}>
            {importing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Importeren…</>
              : `Importeer ${rows.length} WPI's`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
