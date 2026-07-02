import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, UserPlus } from "lucide-react";
import { EmployeesImportDialog } from "@/components/EmployeesImportDialog";

export const Route = createFileRoute("/_authenticated/employees/")({
  head: () => ({ meta: [{ title: "Personeelsfiches — HSE & Kwaliteit" }] }),
  component: EmployeesPage,
});

const employeeSchema = z.object({
  first_name: z.string().trim().min(1, "Voornaam is verplicht").max(100),
  last_name: z.string().trim().min(1, "Naam is verplicht").max(100),
  employer: z.string().trim().max(150).optional().or(z.literal("")),
  email: z.string().trim().email("Ongeldig e-mailadres").max(255).optional().or(z.literal("")),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  function_title: z.string().trim().max(300).optional().or(z.literal("")),
});

function parseFunctions(v?: string | null): string[] {
  if (!v) return [];
  return v.split(",").map((s) => s.trim()).filter(Boolean);
}

function EmployeesPage() {
  const navigate = useNavigate();
  const { hasAnyRole } = useAuth();
  const canEdit = hasAnyRole(["admin", "hse_manager"]);
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [colFilters, setColFilters] = useState({
    name: "",
    employer: "",
    email: "",
    phone: "",
    function_title: "",
    status: "all" as "all" | "active" | "inactive",
  });

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("last_name");
      if (error) throw error;
      return data;
    },
  });

  const match = (val: string | null | undefined, q: string) =>
    !q || (val ?? "").toLowerCase().includes(q.toLowerCase());

  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    const globalOk =
      !q ||
      e.first_name?.toLowerCase().includes(q) ||
      e.last_name?.toLowerCase().includes(q) ||
      e.employer?.toLowerCase().includes(q) ||
      e.email?.toLowerCase().includes(q) ||
      e.function_title?.toLowerCase().includes(q);
    if (!globalOk) return false;
    const fullName = `${e.last_name ?? ""} ${e.first_name ?? ""}`;
    if (!match(fullName, colFilters.name)) return false;
    if (!match(e.employer, colFilters.employer)) return false;
    if (!match(e.email, colFilters.email)) return false;
    if (!match(e.phone, colFilters.phone)) return false;
    if (!match(e.function_title, colFilters.function_title)) return false;
    if (colFilters.status === "active" && !e.active) return false;
    if (colFilters.status === "inactive" && e.active) return false;
    return true;
  });

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = employeeSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) return toast.error(parsed.error.errors[0].message);
    setSaving(true);
    const payload = Object.fromEntries(
      Object.entries(parsed.data).map(([k, v]) => [k, v === "" ? null : v]),
    );
    const { error } = await supabase.from("employees").insert(payload as never);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Personeelsfiche aangemaakt");
    setDialogOpen(false);
    queryClient.invalidateQueries({ queryKey: ["employees"] });
    queryClient.invalidateQueries({ queryKey: ["employees-count"] });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Personeelsfiches</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Beheer van medewerkers — koppeling aan toolboxen, meldingen en RA's.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <EmployeesImportDialog />
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4" /> Nieuwe fiche</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><UserPlus className="w-5 h-5" /> Nieuwe personeelsfiche</DialogTitle>
                <DialogDescription>Basisgegevens van de medewerker.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleAdd} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="first_name">Voornaam *</Label>
                    <Input id="first_name" name="first_name" required maxLength={100} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="last_name">Naam *</Label>
                    <Input id="last_name" name="last_name" required maxLength={100} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="employer">Werkgever</Label>
                  <Input id="employer" name="employer" maxLength={150} placeholder="TSA Safety, uitzendbureau, …" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="email">E-mail</Label>
                    <Input id="email" name="email" type="email" maxLength={255} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Telefoon</Label>
                    <Input id="phone" name="phone" maxLength={30} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="function_title">Functies</Label>
                  <Input
                    id="function_title"
                    name="function_title"
                    maxLength={300}
                    placeholder="Brandwacht, Veiligheidswacht, Gasanalist"
                  />
                  <p className="text-xs text-muted-foreground">Meerdere functies scheiden met een komma.</p>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Annuleren</Button>
                  <Button type="submit" disabled={saving}>Opslaan</Button>
                </DialogFooter>
              </form>
            </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Zoek op naam, werkgever, e-mail of functie…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>Werkgever</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefoon</TableHead>
                  <TableHead>Functies</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
                <TableRow className="bg-muted/30">
                  {([
                    { key: "name", values: employees.map((e) => `${e.last_name ?? ""} ${e.first_name ?? ""}`.trim()) },
                    { key: "employer", values: employees.map((e) => e.employer ?? "") },
                    { key: "email", values: employees.map((e) => e.email ?? "") },
                    { key: "phone", values: employees.map((e) => e.phone ?? "") },
                    { key: "function_title", values: employees.flatMap((e) => parseFunctions(e.function_title)) },
                  ] as const).map(({ key, values }) => {
                    const listId = `filter-${key}`;
                    const unique = Array.from(new Set(values.filter(Boolean))).sort();
                    return (
                      <TableHead key={key} className="py-2">
                        <Input
                          list={listId}
                          value={colFilters[key]}
                          onChange={(e) => setColFilters((f) => ({ ...f, [key]: e.target.value }))}
                          placeholder="Filter…"
                          className="h-8"
                        />
                        <datalist id={listId}>
                          {unique.map((v) => <option key={v} value={v} />)}
                        </datalist>
                      </TableHead>
                    );
                  })}
                  <TableHead className="py-2">
                    <select
                      value={colFilters.status}
                      onChange={(e) => setColFilters((f) => ({ ...f, status: e.target.value as typeof f.status }))}
                      className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="all">Alle</option>
                      <option value="active">Actief</option>
                      <option value="inactive">Uit dienst</option>
                    </select>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Laden…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    {employees.length === 0 ? "Nog geen personeelsfiches. Maak er een aan om te starten." : "Geen resultaten voor je zoekopdracht."}
                  </TableCell></TableRow>
                ) : filtered.map((e) => {
                  const functies = parseFunctions(e.function_title);
                  return (
                    <TableRow
                      key={e.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate({ to: "/employees/$id", params: { id: e.id } })}
                    >
                      <TableCell className="font-medium">{e.last_name} {e.first_name}</TableCell>
                      <TableCell>{e.employer ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.email ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{e.phone ?? "—"}</TableCell>
                      <TableCell>
                        {functies.length === 0 ? "—" : (
                          <div className="flex flex-wrap gap-1">
                            {functies.map((f) => (
                              <Badge key={f} variant="secondary" className="font-normal">{f}</Badge>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {e.active ? <Badge variant="secondary">Actief</Badge> : <Badge variant="outline">Uit dienst</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
