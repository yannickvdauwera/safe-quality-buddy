import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
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
  status: "new" | "duplicate" | "invalid";
  reason?: string;
}

export function EmployeesImportDialog() {
  const [open, setOpen] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const queryClient = useQueryClient();

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
    } catch (err: unknown) {
      toast.error((err as Error).message || "Excel kon niet gelezen worden");
    } finally {
      setParsing(false);
    }
  };

  const doImport = async () => {
    const toInsert = rows.filter((r) => r.status === "new" && r.data).map((r) => r.data!);
    if (toInsert.length === 0) return toast.error("Geen nieuwe rijen om te importeren");
    setImporting(true);
    // batch in chunks of 200
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
  };

  const counts = {
    total: rows.length,
    new: rows.filter((r) => r.status === "new").length,
    dup: rows.filter((r) => r.status === "duplicate").length,
    inv: rows.filter((r) => r.status === "invalid").length,
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setRows([]); setFileName(""); } }}>
      <DialogTrigger asChild>
        <Button variant="outline"><Upload className="w-4 h-4" /> Importeer Excel</Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
            <div className="border rounded-md max-h-[45vh] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Naam</TableHead>
                    <TableHead>Werkgever</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Functie(s)</TableHead>
                    <TableHead>Actief</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r, i) => (
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
                      <TableCell>{r.data?.active ? "Ja" : "Nee"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Annuleren</Button>
          <Button onClick={doImport} disabled={importing || counts.new === 0}>
            {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importeren…</> : `Importeer ${counts.new} nieuwe`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
