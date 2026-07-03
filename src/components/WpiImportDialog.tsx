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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileSpreadsheet, Loader2, UserPlus } from "lucide-react";
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
  const [newEmployeeActive, setNewEmployeeActive] = useState(false);
  const [employees, setEmployees] = useState<{ id: string; first_name: string | null; last_name: string | null }[]>([]);
  const [sortKey, setSortKey] = useState<"row" | "name" | "matched" | "date" | "worksite" | "answered" | "nok">("row");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "matched" | "unmatched">("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkEmployee, setBulkEmployee] = useState("");
  const [newEmpOpen, setNewEmpOpen] = useState(false);
  const [newEmpForm, setNewEmpForm] = useState({
    first_name: "", last_name: "", email: "", phone: "", function_title: "", employer: "", active: true,
  });
  const [creatingEmp, setCreatingEmp] = useState(false);
  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };
  const sortArrow = (key: typeof sortKey) => (sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "");


  const allQuestionKeys = WPI_CONFIG.sections.flatMap((s) => s.questions.map((q) => ({ key: q.key, label: q.label })));
  const sortedEmployees = [...employees].sort((a, b) =>
    `${a.last_name ?? ""} ${a.first_name ?? ""}`.localeCompare(`${b.last_name ?? ""} ${b.first_name ?? ""}`),
  );

  const setRowEmployee = (rowNum: number, employeeId: string) => {
    setRows((prev) => prev.map((r) => {
      if (r.row !== rowNum) return r;
      if (!employeeId) return { ...r, employeeId: undefined, matched: false };
      return { ...r, employeeId, matched: true };
    }));
  };

  const applyBulkAssign = () => {
    const v = bulkEmployee.trim().toLowerCase();
    if (!v) return toast.error("Kies eerst een medewerker");
    if (selected.size === 0) return toast.error("Selecteer eerst rijen");
    const found = employees.find(
      (e) => `${e.last_name ?? ""} ${e.first_name ?? ""}`.trim().toLowerCase() === v,
    );
    if (!found) return toast.error("Onbekende medewerker");
    setRows((prev) => prev.map((r) => (selected.has(r.row) ? { ...r, employeeId: found.id, matched: true } : r)));
    toast.success(`${selected.size} rij(en) toegewezen aan ${found.last_name ?? ""} ${found.first_name ?? ""}`);
    setSelected(new Set());
  };



  const createAndAssignEmployee = async () => {
    if (selected.size === 0) return toast.error("Selecteer eerst rijen");
    const fn = newEmpForm.first_name.trim();
    const ln = newEmpForm.last_name.trim();
    if (!fn || !ln) return toast.error("Voornaam en naam zijn verplicht");
    setCreatingEmp(true);
    try {
      const { data, error } = await supabase
        .from("employees")
        .insert({
          first_name: fn,
          last_name: ln,
          email: newEmpForm.email.trim() || null,
          phone: newEmpForm.phone.trim() || null,
          function_title: newEmpForm.function_title.trim() || null,
          employer: newEmpForm.employer.trim() || null,
          active: newEmpForm.active,
        })
        .select("id, first_name, last_name")
        .single();
      if (error) throw error;
      setEmployees((prev) => [...prev, data]);
      setRows((prev) => prev.map((r) => (selected.has(r.row) ? { ...r, employeeId: data.id, matched: true, newEmployee: false } : r)));
      toast.success(`${selected.size} rij(en) toegewezen aan nieuwe medewerker ${ln} ${fn}`);
      setSelected(new Set());
      setNewEmpOpen(false);
      setNewEmpForm({ first_name: "", last_name: "", email: "", phone: "", function_title: "", employer: "", active: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Onbekende fout";
      toast.error(`Aanmaken mislukt: ${msg}`);
    } finally {
      setCreatingEmp(false);
    }
  };

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
      const { data: employeesData = [] } = await supabase
        .from("employees")
        .select("id, first_name, last_name");
      setEmployees(employeesData ?? []);
      const empMap = new Map<string, string>();
      employeesData?.forEach((e) => {
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
            active: newEmployeeActive,
            notes: `Automatisch aangemaakt via WPI-import (${newEmployeeActive ? "actief" : "inactief"})`,

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
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-6">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={autoCreate} onChange={(e) => setAutoCreate(e.target.checked)} />
                Onbekende namen automatisch aanmaken als personeelsfiche
              </label>
              {autoCreate && (
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">Nieuwe fiches als:</span>
                  <label className="flex items-center gap-1">
                    <input type="radio" name="new-emp-status" checked={!newEmployeeActive}
                      onChange={() => setNewEmployeeActive(false)} />
                    Inactief
                  </label>
                  <label className="flex items-center gap-1">
                    <input type="radio" name="new-emp-status" checked={newEmployeeActive}
                      onChange={() => setNewEmployeeActive(true)} />
                    Actief
                  </label>
                </div>
              )}
            </div>
            <datalist id="wpi-emp-options">
              {sortedEmployees.map((emp) => {
                const label = `${emp.last_name ?? ""} ${emp.first_name ?? ""}`.trim();
                return <option key={emp.id} value={label} />;
              })}
            </datalist>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  placeholder="Zoek op naam of werflocatie…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9 sm:w-64"
                />
                <div className="flex items-center gap-2 text-sm">
                  {(["all", "matched", "unmatched"] as const).map((s) => (
                    <label key={s} className="flex items-center gap-1">
                      <input type="radio" name="wpi-status-filter" checked={statusFilter === s}
                        onChange={() => setStatusFilter(s)} />
                      {s === "all" ? "Alle" : s === "matched" ? "Gekoppeld" : "Niet gekoppeld"}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{selected.size} geselecteerd</span>
                <input
                  type="text"
                  list="wpi-emp-options"
                  value={bulkEmployee}
                  onChange={(e) => setBulkEmployee(e.target.value)}
                  placeholder="Wijs toe aan medewerker…"
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm w-[220px]"
                />
                <Button size="sm" variant="secondary" onClick={applyBulkAssign} disabled={selected.size === 0 || !bulkEmployee.trim()}>
                  <UserPlus className="w-4 h-4" /> Toewijzen
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    if (selected.size === 0) return toast.error("Selecteer eerst rijen");
                    // Prefill from first selected row (name split)
                    const firstRow = rows.find((r) => selected.has(r.row));
                    if (firstRow?.name) {
                      const { first, last } = splitFullName(firstRow.name);
                      setNewEmpForm((f) => ({ ...f, first_name: first || "", last_name: last || "" }));
                    }
                    setNewEmpOpen(true);
                  }}
                  disabled={selected.size === 0}
                >
                  <UserPlus className="w-4 h-4" /> Nieuwe medewerker
                </Button>
              </div>
            </div>

            {(() => {
              const q = search.trim().toLowerCase();
              const filtered = rows.filter((r) => {
                if (statusFilter === "matched" && !r.matched) return false;
                if (statusFilter === "unmatched" && r.matched) return false;
                if (!q) return true;
                return (r.name || "").toLowerCase().includes(q) || (r.worksite || "").toLowerCase().includes(q);
              });
              const sorted = [...filtered].sort((a, b) => {
                const dir = sortDir === "asc" ? 1 : -1;
                const pick = (r: RowResult) => {
                  switch (sortKey) {
                    case "row": return r.row;
                    case "name": return (r.name || "").toLowerCase();
                    case "matched": return r.matched ? 1 : 0;
                    case "date": return r.date ?? "";
                    case "worksite": return (r.worksite || "").toLowerCase();
                    case "answered": return Object.keys(r.answers).length;
                    case "nok": return Object.values(r.answers).filter((v) => v === "nok").length;
                  }
                };
                const av = pick(a), bv = pick(b);
                if (av! < bv!) return -1 * dir;
                if (av! > bv!) return 1 * dir;
                return 0;
              });
              const visible = sorted.slice(0, 500);
              const allVisibleSelected = visible.length > 0 && visible.every((r) => selected.has(r.row));
              const toggleAllVisible = (checked: boolean) => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  visible.forEach((r) => { if (checked) next.add(r.row); else next.delete(r.row); });
                  return next;
                });
              };
              const toggleOne = (rowNum: number, checked: boolean) => {
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (checked) next.add(rowNum); else next.delete(rowNum);
                  return next;
                });
              };
              return (
                <div className="border rounded-md max-h-[45vh] overflow-y-auto">
                  <Table>
                    <TableHeader className="sticky top-0 bg-background z-10">
                      <TableRow>
                        <TableHead className="w-8">
                          <Checkbox checked={allVisibleSelected} onCheckedChange={(c) => toggleAllVisible(!!c)} />
                        </TableHead>
                        <TableHead onClick={() => toggleSort("row")} className="cursor-pointer select-none">#{sortArrow("row")}</TableHead>
                        <TableHead onClick={() => toggleSort("name")} className="cursor-pointer select-none">Naam{sortArrow("name")}</TableHead>
                        <TableHead onClick={() => toggleSort("matched")} className="cursor-pointer select-none">Match{sortArrow("matched")}</TableHead>
                        <TableHead onClick={() => toggleSort("date")} className="cursor-pointer select-none">Datum{sortArrow("date")}</TableHead>
                        <TableHead onClick={() => toggleSort("worksite")} className="cursor-pointer select-none">Werflocatie{sortArrow("worksite")}</TableHead>
                        <TableHead onClick={() => toggleSort("answered")} className="cursor-pointer select-none">Antw.{sortArrow("answered")}</TableHead>
                        <TableHead onClick={() => toggleSort("nok")} className="cursor-pointer select-none">NOK{sortArrow("nok")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {visible.map((r) => {
                        const answered = Object.keys(r.answers).length;
                        const nok = Object.values(r.answers).filter((v) => v === "nok").length;
                        const currentEmp = r.employeeId ? employees.find((e) => e.id === r.employeeId) : null;
                        const currentLabel = currentEmp
                          ? `${currentEmp.last_name ?? ""} ${currentEmp.first_name ?? ""}`.trim()
                          : "";
                        const onPick = (val: string) => {
                          const v = val.trim().toLowerCase();
                          if (!v) return setRowEmployee(r.row, "");
                          const found = employees.find(
                            (e) => `${e.last_name ?? ""} ${e.first_name ?? ""}`.trim().toLowerCase() === v,
                          );
                          if (found) setRowEmployee(r.row, found.id);
                        };
                        return (
                          <TableRow key={r.row}>
                            <TableCell>
                              <Checkbox checked={selected.has(r.row)} onCheckedChange={(c) => toggleOne(r.row, !!c)} />
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.row}</TableCell>
                            <TableCell className="text-sm">{r.name || "—"}</TableCell>
                            <TableCell className="text-xs">
                              <div className="flex items-center gap-2">
                                {r.matched && <span className="text-emerald-600 font-medium">✓</span>}
                                <input
                                  type="text"
                                  list="wpi-emp-options"
                                  defaultValue={currentLabel}
                                  placeholder={r.matched ? "" : autoCreate ? "Nieuw wordt aangemaakt…" : "Zoek medewerker…"}
                                  onChange={(e) => onPick(e.target.value)}
                                  onBlur={(e) => onPick(e.target.value)}
                                  className="h-7 rounded-md border border-input bg-background px-2 text-xs w-[200px]"
                                />
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">{r.date ? new Date(r.date).toLocaleDateString("nl-BE") : "—"}</TableCell>
                            <TableCell className="text-xs">{r.worksite || "—"}</TableCell>
                            <TableCell className="text-xs">{answered}</TableCell>
                            <TableCell className={`text-xs ${nok > 0 ? "text-destructive font-medium" : ""}`}>{nok}</TableCell>
                          </TableRow>
                        );
                      })}
                      {visible.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">
                            Geen rijen voor deze filter.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  {filtered.length > 500 && (
                    <p className="text-xs text-center text-muted-foreground py-2">
                      Voorbeeld beperkt tot 500 rijen — alle {filtered.length} filtresultaten worden meegenomen bij import/toewijzing.
                    </p>
                  )}
                </div>
              );
            })()}

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

      <Dialog open={newEmpOpen} onOpenChange={(o) => !creatingEmp && setNewEmpOpen(o)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nieuwe medewerker aanmaken</DialogTitle>
            <DialogDescription>
              Vul de gegevens in. De {selected.size} geselecteerde rij(en) worden aan deze nieuwe medewerker gekoppeld.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-1">
              <label className="text-xs font-medium">Voornaam *</label>
              <Input value={newEmpForm.first_name} onChange={(e) => setNewEmpForm((f) => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div className="col-span-1">
              <label className="text-xs font-medium">Naam *</label>
              <Input value={newEmpForm.last_name} onChange={(e) => setNewEmpForm((f) => ({ ...f, last_name: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium">E-mail</label>
              <Input type="email" value={newEmpForm.email} onChange={(e) => setNewEmpForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="col-span-1">
              <label className="text-xs font-medium">Telefoon</label>
              <Input value={newEmpForm.phone} onChange={(e) => setNewEmpForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="col-span-1">
              <label className="text-xs font-medium">Werkgever</label>
              <Input value={newEmpForm.employer} onChange={(e) => setNewEmpForm((f) => ({ ...f, employer: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-medium">Functie</label>
              <Input value={newEmpForm.function_title} onChange={(e) => setNewEmpForm((f) => ({ ...f, function_title: e.target.value }))} />
            </div>
            <div className="col-span-2 flex items-center gap-4 pt-1 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={newEmpForm.active} onChange={() => setNewEmpForm((f) => ({ ...f, active: true }))} />
                Actief
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={!newEmpForm.active} onChange={() => setNewEmpForm((f) => ({ ...f, active: false }))} />
                Inactief
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewEmpOpen(false)} disabled={creatingEmp}>Annuleren</Button>
            <Button onClick={createAndAssignEmployee} disabled={creatingEmp}>
              {creatingEmp ? <><Loader2 className="w-4 h-4 animate-spin" /> Aanmaken…</> : `Aanmaken & koppelen (${selected.size})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
