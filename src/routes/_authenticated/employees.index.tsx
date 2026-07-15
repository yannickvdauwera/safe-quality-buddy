import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listWorkers, inviteWorker, setWorkerRole, deleteWorker, ensureEmployeeForUser,
} from "@/lib/admin-users.functions";
import {
  listJobFunctions, createJobFunction, updateJobFunction, deleteJobFunction, setUserFunctionTitles,
} from "@/lib/job-functions.functions";
import { MultiFunctionSelect } from "@/components/MultiFunctionSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users, UserPlus, MoreHorizontal, Search, Trash2, Shield, IdCard, Mail, Briefcase, Plus, Pencil,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/employees/")({
  head: () => ({ meta: [{ title: "Medewerkers — HSE & Kwaliteit" }] }),
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "hse_manager"]);
    if (!data || data.length === 0) throw redirect({ to: "/dashboard" });
  },
  component: MedewerkersPage,
});

type WorkerRole = "gebruiker" | "manager";
const ROLE_LABELS: Record<WorkerRole, string> = { gebruiker: "Gebruiker", manager: "Manager" };
const ROLE_BADGE: Record<WorkerRole, string> = {
  gebruiker: "bg-muted text-foreground",
  manager: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
};

interface Worker {
  id: string;
  email: string | null;
  full_name: string | null;
  function_title: string | null;
  function_titles: string[];
  roles: string[];
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  employee: { id: string; name: string; employer: string | null; active: boolean } | null;
}

function MedewerkersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listWorkers);
  const inviteFn = useServerFn(inviteWorker);
  const roleFn = useServerFn(setWorkerRole);
  const deleteFn = useServerFn(deleteWorker);
  const ensureFicheFn = useServerFn(ensureEmployeeForUser);
  const listFuncsFn = useServerFn(listJobFunctions);
  const setTitlesFn = useServerFn(setUserFunctionTitles);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | WorkerRole>("all");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ userId: string; name: string } | null>(null);
  const [functionsDialog, setFunctionsDialog] = useState<{ userId: string; name: string; current: string[] } | null>(null);
  const [manageFuncs, setManageFuncs] = useState(false);

  const [isAdmin, setIsAdmin] = useState(false);
  useState(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: r } = await supabase.from("user_roles").select("role").eq("user_id", data.user.id).eq("role", "admin").maybeSingle();
      setIsAdmin(!!r);
    });
    return 0;
  });

  const { data: workers = [], isLoading } = useQuery<Worker[]>({
    queryKey: ["medewerkers"],
    queryFn: () => listFn() as Promise<Worker[]>,
  });

  const { data: jobFunctions = [] } = useQuery({
    queryKey: ["job-functions"],
    queryFn: () => listFuncsFn(),
  });
  const jobFunctionNames = jobFunctions.map((f: { name: string }) => f.name);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["medewerkers"] });
    queryClient.invalidateQueries({ queryKey: ["employees"] });
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const inviteMut = useMutation({
    mutationFn: (data: { email: string; full_name: string; role: WorkerRole; function_titles: string[] }) =>
      inviteFn({ data }),
    onSuccess: () => { toast.success("Uitnodiging verzonden"); setInviteOpen(false); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const roleMut = useMutation({
    mutationFn: (data: { user_id: string; role: WorkerRole }) => roleFn({ data }),
    onSuccess: () => { toast.success("Rol bijgewerkt"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (data: { user_id: string }) => deleteFn({ data }),
    onSuccess: () => { toast.success("Medewerker verwijderd"); setDeleteDialog(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const openFicheMut = useMutation({
    mutationFn: (user_id: string) => ensureFicheFn({ data: { user_id } }),
    onSuccess: (res) => navigate({ to: "/employees/$id", params: { id: res.employee_id } }),
    onError: (e: Error) => toast.error(e.message),
  });

  const setTitlesMut = useMutation({
    mutationFn: (data: { user_id: string; function_titles: string[] }) => setTitlesFn({ data }),
    onSuccess: () => { toast.success("Functies bijgewerkt"); setFunctionsDialog(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = workers.filter((w) => {
    if (roleFilter !== "all" && !w.roles.includes(roleFilter)) return false;
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      w.full_name?.toLowerCase().includes(q) ||
      w.email?.toLowerCase().includes(q) ||
      (w.function_titles ?? []).some((t) => t.toLowerCase().includes(q)) ||
      w.employee?.employer?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Users className="w-6 h-6" /> Medewerkers
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Beheer accounts met rol <em>Gebruiker</em> of <em>Manager</em>. Admins en HSE-managers beheer je onder{" "}
            <button className="underline" onClick={() => navigate({ to: "/users" })}>Instellingen › Gebruikers &amp; rollen</button>.
          </p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setManageFuncs(true)}>
              <Briefcase className="w-4 h-4" /> Beheer functies
            </Button>
          )}
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button><UserPlus className="w-4 h-4" /> Medewerker uitnodigen</Button>
            </DialogTrigger>
            <InviteDialog
              onSubmit={(v) => inviteMut.mutate(v)}
              loading={inviteMut.isPending}
              jobFunctions={jobFunctionNames}
            />
          </Dialog>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[240px] max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Zoek op naam, e-mail, functie…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v as "all" | WorkerRole)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle rollen</SelectItem>
                <SelectItem value="gebruiker">Gebruikers</SelectItem>
                <SelectItem value="manager">Managers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Functies</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Fiche</TableHead>
                  <TableHead>Laatste aanmelding</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Laden…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-12">Geen medewerkers gevonden.</TableCell></TableRow>
                ) : filtered.map((w) => {
                  const primaryRole = (w.roles.find((r) => r === "manager") ?? w.roles[0] ?? "gebruiker") as WorkerRole;
                  const titles = w.function_titles?.length ? w.function_titles : (w.function_title ? [w.function_title] : []);
                  return (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">
                        {w.full_name ?? "—"}
                        {!w.email_confirmed_at && (
                          <Badge variant="outline" className="ml-2 text-xs">Uitgenodigd</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{w.email ?? "—"}</TableCell>
                      <TableCell>
                        <button
                          type="button"
                          className="flex flex-wrap gap-1 text-left hover:opacity-80"
                          onClick={() => setFunctionsDialog({ userId: w.id, name: w.full_name ?? w.email ?? "medewerker", current: titles })}
                        >
                          {titles.length === 0 ? (
                            <span className="text-xs text-muted-foreground italic">— klik om toe te wijzen —</span>
                          ) : titles.map((t) => (
                            <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>
                          ))}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={primaryRole}
                          onValueChange={(v) => roleMut.mutate({ user_id: w.id, role: v as WorkerRole })}
                          disabled={roleMut.isPending}
                        >
                          <SelectTrigger className={`h-7 text-xs w-32 border-0 ${ROLE_BADGE[primaryRole]}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="gebruiker">{ROLE_LABELS.gebruiker}</SelectItem>
                            <SelectItem value="manager">{ROLE_LABELS.manager}</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {w.employee ? (
                          <Button variant="link" size="sm" className="h-auto p-0 text-sm"
                            onClick={() => navigate({ to: "/employees/$id", params: { id: w.employee!.id } })}>
                            Bekijk fiche
                          </Button>
                        ) : (
                          <Button variant="ghost" size="sm" className="h-7 text-xs"
                            onClick={() => openFicheMut.mutate(w.id)}
                            disabled={openFicheMut.isPending}>
                            <IdCard className="w-3.5 h-3.5" /> Fiche openen
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {w.last_sign_in_at ? new Date(w.last_sign_in_at).toLocaleDateString("nl-BE") : "—"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Acties</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setFunctionsDialog({ userId: w.id, name: w.full_name ?? w.email ?? "medewerker", current: titles })}>
                              <Briefcase className="w-4 h-4" /> Functies aanpassen
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openFicheMut.mutate(w.id)}>
                              <IdCard className="w-4 h-4" /> Ga naar fiche
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeleteDialog({ userId: w.id, name: w.full_name ?? w.email ?? "medewerker" })}
                            >
                              <Trash2 className="w-4 h-4" /> Verwijder medewerker
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {!isAdmin && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Shield className="w-3 h-3" /> Alleen administrators kunnen de lijst van functies wijzigen.
        </p>
      )}

      {functionsDialog && (
        <FunctionsDialog
          initial={functionsDialog}
          options={jobFunctionNames}
          loading={setTitlesMut.isPending}
          onClose={() => setFunctionsDialog(null)}
          onSave={(v) => setTitlesMut.mutate({ user_id: functionsDialog.userId, function_titles: v })}
        />
      )}

      {manageFuncs && (
        <ManageFunctionsDialog onClose={() => setManageFuncs(false)} />
      )}

      <AlertDialog open={!!deleteDialog} onOpenChange={(o) => !o && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Medewerker verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Je staat op het punt <strong>{deleteDialog?.name}</strong> definitief te verwijderen.
              Het account en de rollen worden verwijderd; de personeelsfiche blijft bestaan
              (zonder gebruikerskoppeling). Deze actie kan niet ongedaan gemaakt worden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMut.isPending}
              onClick={(e) => { e.preventDefault(); if (deleteDialog) deleteMut.mutate({ user_id: deleteDialog.userId }); }}
            >Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InviteDialog({
  onSubmit, loading, jobFunctions,
}: {
  onSubmit: (v: { email: string; full_name: string; role: WorkerRole; function_titles: string[] }) => void;
  loading: boolean;
  jobFunctions: string[];
}) {
  const [role, setRole] = useState<WorkerRole>("gebruiker");
  const [titles, setTitles] = useState<string[]>(["Brand- en veiligheidswacht"]);

  const handle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const full_name = String(fd.get("full_name") ?? "").trim();
    if (!email || !full_name) return toast.error("Naam en e-mail zijn verplicht");
    onSubmit({ email, full_name, role, function_titles: titles });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Mail className="w-5 h-5" /> Medewerker uitnodigen</DialogTitle>
        <DialogDescription>De medewerker ontvangt een uitnodigingsmail om een wachtwoord in te stellen.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handle} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">Volledige naam</Label>
            <Input id="inv-name" name="full_name" required maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">E-mail</Label>
            <Input id="inv-email" name="email" type="email" required maxLength={255} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Functies</Label>
          <MultiFunctionSelect
            options={jobFunctions}
            value={titles}
            onChange={setTitles}
            emptyText="Geen functies. Vraag een admin om ze aan te maken."
          />
        </div>
        <div className="space-y-1.5">
          <Label>Rol</Label>
          <Select value={role} onValueChange={(v) => setRole(v as WorkerRole)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="gebruiker">{ROLE_LABELS.gebruiker}</SelectItem>
              <SelectItem value="manager">{ROLE_LABELS.manager}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Shield className="w-3 h-3 mt-0.5 shrink-0" />
            Admin- en HSE-manager-rollen worden beheerd onder Instellingen › Gebruikers &amp; rollen.
          </p>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading}>Uitnodigen</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function FunctionsDialog({
  initial, options, loading, onClose, onSave,
}: {
  initial: { userId: string; name: string; current: string[] };
  options: string[];
  loading: boolean;
  onClose: () => void;
  onSave: (v: string[]) => void;
}) {
  const [value, setValue] = useState<string[]>(initial.current);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Functies voor {initial.name}</DialogTitle>
          <DialogDescription>Kies één of meerdere functies uit de beheerde lijst.</DialogDescription>
        </DialogHeader>
        <MultiFunctionSelect
          options={options}
          value={value}
          onChange={setValue}
          emptyText="Geen functies. Vraag een admin om ze aan te maken."
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuleren</Button>
          <Button onClick={() => onSave(value)} disabled={loading}>Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManageFunctionsDialog({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listJobFunctions);
  const createFn = useServerFn(createJobFunction);
  const updateFn = useServerFn(updateJobFunction);
  const deleteFn = useServerFn(deleteJobFunction);

  const { data = [] } = useQuery({ queryKey: ["job-functions"], queryFn: () => listFn() });
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["job-functions"] });
    queryClient.invalidateQueries({ queryKey: ["medewerkers"] });
  };

  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);

  const createMut = useMutation({
    mutationFn: (name: string) => createFn({ data: { name } }),
    onSuccess: () => { toast.success("Functie toegevoegd"); setNewName(""); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const updateMut = useMutation({
    mutationFn: (v: { id: string; name: string }) => updateFn({ data: v }),
    onSuccess: () => { toast.success("Functie bijgewerkt"); setEditing(null); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success("Functie verwijderd"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Briefcase className="w-5 h-5" /> Functies beheren</DialogTitle>
          <DialogDescription>Beheer de dropdown-lijst met functies. Alleen administrators kunnen deze wijzigen.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            placeholder="Nieuwe functie…"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={200}
          />
          <Button
            onClick={() => { const n = newName.trim(); if (n) createMut.mutate(n); }}
            disabled={createMut.isPending || !newName.trim()}
          >
            <Plus className="w-4 h-4" /> Toevoegen
          </Button>
        </div>
        <div className="border rounded-md divide-y max-h-80 overflow-y-auto">
          {data.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nog geen functies aangemaakt.</div>
          ) : data.map((f: { id: string; name: string }) => (
            <div key={f.id} className="flex items-center gap-2 px-3 py-2">
              {editing?.id === f.id ? (
                <>
                  <Input
                    value={editing.name}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    className="h-8"
                    maxLength={200}
                  />
                  <Button size="sm" onClick={() => updateMut.mutate({ id: editing.id, name: editing.name.trim() })} disabled={updateMut.isPending}>Opslaan</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Annuleren</Button>
                </>
              ) : (
                <>
                  <span className="flex-1 text-sm">{f.name}</span>
                  <Button size="icon" variant="ghost" onClick={() => setEditing({ id: f.id, name: f.name })}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive"
                    onClick={() => {
                      if (confirm(`"${f.name}" verwijderen? Deze functie wordt ook van alle profielen verwijderd.`)) {
                        deleteMut.mutate(f.id);
                      }
                    }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Sluiten</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
