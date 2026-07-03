import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, FileSpreadsheet, Loader2, ArrowUpDown, ArrowUp, ArrowDown, Users, Ban } from "lucide-react";
import {
  readSheetAsMatrix, findHeaderRow, matrixToRecords, splitFullName, cellString, nameKey,
} from "@/lib/import-utils";

/** Column aliases per employee field (case-insensitive contains-match). */
const FIELD_ALIASES: Record<string, string[]> = {
  full_name: ["name", "naam", "volledige naam"],
  first_name: ["voornaam", "first name"],
  last_name: ["achternaam", "last name", "familienaam"],
  nickname: ["roepnaam", "nickname"],
  employer: ["werkgever", "employer"],
  email: ["email", "e-mail", "mail"],
  phone: ["telefoon", "phone", "gsm", "tel"],
  function_title: ["functie", "function"],
  end_date: ["uit dienst", "einddatum contract", "out of service"],
};

function matchCol(header: string, aliases: string[]): boolean {
  const h = header.toLowerCase();
  return aliases.some((a) => h === a || h.startsWith(a) || h.includes(a));
}

function mapRow(record: Record<string, unknown>): {
  first_name: string; last_name: string; nickname: string | null; employer: string | null;
  email: string | null; phone: string | null; function_title: string | null; active: boolean;
} | null {
  const headers = Object.keys(record);
  const pick = (field: string) => {
    const col = headers.find((h) => matchCol(h, FIELD_ALIASES[field]));
    return col ? cellString(record[col]) : "";
  };
  let first = pick("first_name");
  let last = pick("last_name");
  if ((!first || !last) && pick("full_name")) {
    const { first: f, last: l } = splitFullName(pick("full_name"));
    if (!first) first = f;
    if (!last) last = l;
  }
  if (!first && !last) return null;
  const endDate = pick("end_date");
  return {
    first_name: first || "—",
    last_name: last || "—",
    nickname: pick("nickname") || null,
    employer: pick("employer") || null,
    email: pick("email").toLowerCase() || null,
    phone: pick("phone") || null,
    function_title: pick("function_title") || null,
    active: !endDate,
  };
}

interface ImportRow {
  data: ReturnType<typeof mapRow>;
  status: "new" | "duplicate" | "invalid" | "skip";
  reason?: string;
}

type SortKey = "status" | "name" | "employer" | "email" | "function" | "active";
type StatusOverride = "excel" | "active" | "inactive";

export function EmployeesImportDialog() {
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "new" | "duplicate" | "invalid" | "skip">("all");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [statusOverride, setStatusOverride] = useState<StatusOverride>("excel");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkEmployer, setBulkEmployer] = useState("");
  const queryClient = useQueryClient();
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);

  const handleFile = async (file: File) => {
    setParsing(true);
    setFileName(file.name);
    try {
      const matrix = await readSheetAsMatrix(file);
      const headerRow = findHeaderRow(matrix, "Name");
      const records = matrixToRecords(matrix, headerRow);
      const mapped = records.map(mapRow);

      // Fetch existing employees for duplicate detection (by name key + email).
      const { data: existing = [] } = await supabase
        .from("employees")
        .select("first_name,last_name,email");
      const existingKeys = new Set<string>();
      const existingEmails = new Set<string>();
      existing?.forEach((e) => {
        existingKeys.add(nameKey(`${e.first_name ?? ""} ${e.last_name ?? ""}`));
        if (e.email) existingEmails.add(e.email.toLowerCase());
      });

      const seenLocalKeys = new Set<string>();
      const parsed: ImportRow[] = mapped.map((m) => {
        if (!m) return { data: m, status: "invalid", reason: "Geen naam gevonden" };
        const k = nameKey(`${m.first_name} ${m.last_name}`);
        if (existingKeys.has(k) || (m.email && existingEmails.has(m.email))) {
          return { data: m, status: "duplicate", reason: "Reeds in database" };
        }
        if (seenLocalKeys.has(k)) return { data: m, status: "duplicate", reason: "Dubbel in Excel" };
        seenLocalKeys.add(k);
        return { data: m, status: "new" };
      });
      setRows(parsed);
      setSelected(new Set());
    } catch (err: unknown) {
      toast.error((err as Error).message || "Excel kon niet gelezen worden");
    } finally {
      setParsing(false);
    }
  };

  const applyActive = (rowActive: boolean): boolean => {
    if (statusOverride === "active") return true;
    if (statusOverride === "inactive") return false;
    return rowActive;
  };

  const doImport = async () => {
    const toInsert = rows
      .filter((r) => r.status === "new" && r.data)
      .map((r) => ({ ...r.data!, active: applyActive(r.data!.active) }));
    if (toInsert.length === 0) return toast.error("Geen nieuwe rijen om te importeren");
    setImporting(true);
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 200) {
      const chunk = toInsert.slice(i, i + 200);
      const { error } = await supabase.from("employees").insert(chunk as never);
      if (error) {
        setImporting(false);
        return toast.error(error.message);
      }
      inserted += chunk.length;
    }
    setImporting(false);
    toast.success(`${inserted} medewerker(s) geïmporteerd`);
    queryClient.invalidateQueries({ queryKey: ["employees"] });
    queryClient.invalidateQueries({ queryKey: ["employees-picker"] });
    setOpen(false);
    setRows([]);
    setFileName("");
    setSearch("");
  };

  const counts = {
    total: rows.length,
    new: rows.filter((r) => r.status === "new").length,
    dup: rows.filter((r) => r.status === "duplicate").length,
    inv: rows.filter((r) => r.status === "invalid").length,
    skip: rows.filter((r) => r.status === "skip").length,
  };

  const filteredSortedRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list: Array<{ row: ImportRow; idx: number }> = rows.map((row, idx) => ({ row, idx }));
    if (statusFilter !== "all") list = list.filter(({ row }) => row.status === statusFilter);
    if (q) {
      list = list.filter(({ row: r }) => {
        const d = r.data;
        const hay = [
          d?.first_name, d?.last_name, d?.nickname, d?.employer, d?.email,
          d?.phone, d?.function_title, r.reason, r.status,
        ].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      });
    }
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      const val = (r: ImportRow): string | number => {
        switch (sortKey) {
          case "status": return r.status;
          case "name": return `${r.data?.last_name ?? ""} ${r.data?.first_name ?? ""}`.toLowerCase();
          case "employer": return (r.data?.employer ?? "").toLowerCase();
          case "email": return (r.data?.email ?? "").toLowerCase();
          case "function": return (r.data?.function_title ?? "").toLowerCase();
          case "active": return r.data?.active ? 1 : 0;
        }
      };
      list = [...list].sort((a, b) => {
        const av = val(a.row), bv = val(b.row);
        if (av < bv) return -1 * dir;
        if (av > bv) return 1 * dir;
        return 0;
      });
    }
    return list;
  }, [rows, search, statusFilter, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortableHead = ({ k, children }: { k: SortKey; children: React.ReactNode }) => {
    const Icon = sortKey !== k ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
    return (
      <TableHead>
        <button
          type="button"
          onClick={() => toggleSort(k)}
          className="inline-flex items-center gap-1 hover:text-foreground text-left"
        >
          {children}
          <Icon className="w-3 h-3 opacity-60" />
        </button>
      </TableHead>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v && rows.length > 0) { setConfirmCloseOpen(true); return; }
      setOpen(v); if (!v) { setRows([]); setFileName(""); setSearch(""); }
    }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="w-4 h-4" /> Importeer Excel</Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" /> Personeelsfiches importeren
          </DialogTitle>
          <DialogDescription>
            Excel wordt automatisch gemapt. Verwachte kolommen: <b>Name</b> of <b>Voornaam</b>/<b>Achternaam</b>,
            optioneel <b>Roepnaam</b>, <b>Werkgever</b>, <b>Email</b>, <b>Telefoon</b>, <b>Functie(s)</b>, <b>Uit dienst</b>.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
            <FileSpreadsheet className="w-10 h-10 mx-auto text-muted-foreground" />
            <div>
              <label className="cursor-pointer">
                <span className="text-sm font-medium underline">Kies een .xlsx bestand</span>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  disabled={parsing}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                  }}
                />
              </label>
              <p className="text-xs text-muted-foreground mt-1">
                {parsing ? "Bezig met inlezen…" : "Enkel de eerste tab wordt verwerkt."}
              </p>
            </div>
          </div>
        ) : (
          <>
            <Alert>
              <AlertDescription className="text-sm">
                <b>{fileName}</b> — {counts.total} rijen: {counts.new} nieuw, {counts.dup} duplicaten (worden overgeslagen),
                {" "}{counts.inv} ongeldig.
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-sm flex-wrap">
                <span className="text-muted-foreground">Nieuwe fiches als:</span>
                <label className="flex items-center gap-1">
                  <input type="radio" name="emp-imp-status" checked={statusOverride === "excel"}
                    onChange={() => setStatusOverride("excel")} />
                  Volgens Excel
                </label>
                <label className="flex items-center gap-1">
                  <input type="radio" name="emp-imp-status" checked={statusOverride === "active"}
                    onChange={() => setStatusOverride("active")} />
                  Actief
                </label>
                <label className="flex items-center gap-1">
                  <input type="radio" name="emp-imp-status" checked={statusOverride === "inactive"}
                    onChange={() => setStatusOverride("inactive")} />
                  Inactief
                </label>
              </div>
              <Input
                placeholder="Zoek op naam, werkgever, e-mail…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="sm:w-72 h-9"
              />
            </div>

            <div className="border rounded-md max-h-[45vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <SortableHead k="status">Status</SortableHead>
                    <SortableHead k="name">Naam</SortableHead>
                    <SortableHead k="employer">Werkgever</SortableHead>
                    <SortableHead k="email">Email</SortableHead>
                    <SortableHead k="function">Functie(s)</SortableHead>
                    <SortableHead k="active">Actief</SortableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSortedRows.map((r, i) => {
                    const effActive = r.data ? applyActive(r.data.active) : false;
                    return (
                      <TableRow key={i} className={r.status === "duplicate" ? "opacity-50" : r.status === "invalid" ? "opacity-40" : ""}>
                        <TableCell className="text-xs">
                          {r.status === "new" && <span className="text-emerald-600 font-medium">Nieuw</span>}
                          {r.status === "duplicate" && <span className="text-muted-foreground">{r.reason}</span>}
                          {r.status === "invalid" && <span className="text-destructive">{r.reason}</span>}
                        </TableCell>
                        <TableCell>{r.data ? `${r.data.last_name} ${r.data.first_name}` : "—"}</TableCell>
                        <TableCell>{r.data?.employer ?? "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{r.data?.email ?? "—"}</TableCell>
                        <TableCell className="text-xs">{r.data?.function_title ?? "—"}</TableCell>
                        <TableCell>{effActive ? "Ja" : "Nee"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {filteredSortedRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">
                        Geen resultaten voor "{search}".
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => {
            if (rows.length > 0) { setConfirmCloseOpen(true); }
            else { setOpen(false); }
          }}>Annuleren</Button>
          <Button onClick={doImport} disabled={importing || counts.new === 0}>
            {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importeren…</> : `Importeer ${counts.new} nieuwe`}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog open={confirmCloseOpen} onOpenChange={setConfirmCloseOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importeren afbreken?</AlertDialogTitle>
            <AlertDialogDescription>
              Je hebt {rows.length} rij(en) geladen die nog niet zijn geïmporteerd. Als je dit venster sluit, gaan deze gegevens verloren.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmCloseOpen(false)}>Nee, blijf open</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setConfirmCloseOpen(false);
              setOpen(false);
              setRows([]);
              setFileName("");
              setSearch("");
            }}>
              Ja, sluit venster
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
