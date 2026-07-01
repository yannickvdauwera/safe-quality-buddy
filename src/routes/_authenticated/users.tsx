import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  listUsersWithRoles,
  setUserRoles,
  inviteUser,
  linkEmployee,
  listUnlinkedEmployees,
} from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { UserPlus, MoreHorizontal, Link2, Shield, Mail, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Gebruikers & rollen — HSE & Kwaliteit" }] }),
  beforeLoad: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: UsersPage,
});

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin", description: "Volledige beheerrechten" },
  { value: "hse_manager", label: "HSE-manager", description: "HSE- en kwaliteitsbeheer" },
  { value: "manager", label: "Manager", description: "Leidinggevende, teamweergave" },
  { value: "operator", label: "Operator", description: "Standaardgebruiker" },
] as const;
type RoleValue = (typeof ROLE_OPTIONS)[number]["value"];

const roleBadge: Record<RoleValue, string> = {
  admin: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  hse_manager: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200",
  manager: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200",
  operator: "bg-muted text-foreground",
};

function UsersPage() {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listUsersWithRoles);
  const setRolesFn = useServerFn(setUserRoles);
  const inviteFn = useServerFn(inviteUser);
  const linkFn = useServerFn(linkEmployee);
  const unlinkedFn = useServerFn(listUnlinkedEmployees);

  const [search, setSearch] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [rolesDialog, setRolesDialog] = useState<{ userId: string; name: string; roles: RoleValue[] } | null>(null);
  const [linkDialog, setLinkDialog] = useState<{ userId: string; name: string; currentEmployeeId: string | null } | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => listFn(),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    queryClient.invalidateQueries({ queryKey: ["employees"] });
  };

  const inviteMut = useMutation({
    mutationFn: (data: { email: string; full_name: string; roles: RoleValue[] }) => inviteFn({ data }),
    onSuccess: () => {
      toast.success("Uitnodiging verzonden");
      setInviteOpen(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rolesMut = useMutation({
    mutationFn: (data: { user_id: string; roles: RoleValue[] }) => setRolesFn({ data }),
    onSuccess: () => {
      toast.success("Rollen bijgewerkt");
      setRolesDialog(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkMut = useMutation({
    mutationFn: (data: { user_id: string; employee_id: string | null }) => linkFn({ data }),
    onSuccess: () => {
      toast.success("Personeelsfiche gekoppeld");
      setLinkDialog(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      u.email?.toLowerCase().includes(q) ||
      u.full_name?.toLowerCase().includes(q) ||
      u.roles.some((r) => r.includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6" /> Gebruikers & rollen
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Beheer accounts, wijs rollen toe en koppel gebruikers aan personeelsfiches.
          </p>
        </div>
        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="w-4 h-4" /> Gebruiker uitnodigen</Button>
          </DialogTrigger>
          <InviteDialog onSubmit={(v) => inviteMut.mutate(v)} loading={inviteMut.isPending} />
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <div className="relative max-w-sm">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Zoek op naam, e-mail, rol…"
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
                  <TableHead>E-mail</TableHead>
                  <TableHead>Rollen</TableHead>
                  <TableHead>Personeelsfiche</TableHead>
                  <TableHead>Laatste aanmelding</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Laden…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">Geen gebruikers gevonden.</TableCell></TableRow>
                ) : filtered.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.full_name ?? "—"}
                      {!u.email_confirmed_at && (
                        <Badge variant="outline" className="ml-2 text-xs">Uitgenodigd</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{u.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 ? (
                          <span className="text-xs text-muted-foreground italic">geen rol</span>
                        ) : u.roles.map((r) => (
                          <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleBadge[r as RoleValue] ?? ""}`}>
                            {ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {u.employee ? (
                        <span className="text-sm">{u.employee.name}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">niet gekoppeld</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString("nl-BE") : "—"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreHorizontal className="w-4 h-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Acties</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setRolesDialog({
                            userId: u.id,
                            name: u.full_name ?? u.email ?? "gebruiker",
                            roles: u.roles as RoleValue[],
                          })}>
                            <Shield className="w-4 h-4" /> Rollen aanpassen
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setLinkDialog({
                            userId: u.id,
                            name: u.full_name ?? u.email ?? "gebruiker",
                            currentEmployeeId: u.employee?.id ?? null,
                          })}>
                            <Link2 className="w-4 h-4" /> Koppel personeelsfiche
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {rolesDialog && (
        <RolesDialog
          initial={rolesDialog}
          loading={rolesMut.isPending}
          onClose={() => setRolesDialog(null)}
          onSave={(roles) => rolesMut.mutate({ user_id: rolesDialog.userId, roles })}
        />
      )}

      {linkDialog && (
        <LinkEmployeeDialog
          initial={linkDialog}
          loading={linkMut.isPending}
          fetchEmployees={() => unlinkedFn()}
          onClose={() => setLinkDialog(null)}
          onSave={(employee_id) => linkMut.mutate({ user_id: linkDialog.userId, employee_id })}
        />
      )}
    </div>
  );
}

function InviteDialog({
  onSubmit, loading,
}: {
  onSubmit: (v: { email: string; full_name: string; roles: RoleValue[] }) => void;
  loading: boolean;
}) {
  const [roles, setRoles] = useState<RoleValue[]>(["operator"]);

  const toggle = (r: RoleValue) =>
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  const handle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "").trim();
    const full_name = String(fd.get("full_name") ?? "").trim();
    if (!email || !full_name) return toast.error("Naam en e-mail zijn verplicht");
    if (roles.length === 0) return toast.error("Kies minstens één rol");
    onSubmit({ email, full_name, roles });
  };

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Mail className="w-5 h-5" /> Gebruiker uitnodigen</DialogTitle>
        <DialogDescription>De gebruiker ontvangt een uitnodigingsmail om een wachtwoord in te stellen.</DialogDescription>
      </DialogHeader>
      <form onSubmit={handle} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="inv-name">Volledige naam</Label>
          <Input id="inv-name" name="full_name" required maxLength={100} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="inv-email">E-mail</Label>
          <Input id="inv-email" name="email" type="email" required maxLength={255} />
        </div>
        <div className="space-y-2">
          <Label>Rollen</Label>
          <div className="space-y-2 border rounded-md p-3">
            {ROLE_OPTIONS.map((o) => (
              <label key={o.value} className="flex items-start gap-2 cursor-pointer">
                <Checkbox checked={roles.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
                <div>
                  <div className="text-sm font-medium">{o.label}</div>
                  <div className="text-xs text-muted-foreground">{o.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" disabled={loading}>Uitnodigen</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function RolesDialog({
  initial, loading, onClose, onSave,
}: {
  initial: { userId: string; name: string; roles: RoleValue[] };
  loading: boolean;
  onClose: () => void;
  onSave: (roles: RoleValue[]) => void;
}) {
  const [roles, setRoles] = useState<RoleValue[]>(initial.roles);
  const toggle = (r: RoleValue) =>
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rollen voor {initial.name}</DialogTitle>
          <DialogDescription>Selecteer één of meerdere rollen.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 border rounded-md p-3">
          {ROLE_OPTIONS.map((o) => (
            <label key={o.value} className="flex items-start gap-2 cursor-pointer">
              <Checkbox checked={roles.includes(o.value)} onCheckedChange={() => toggle(o.value)} />
              <div>
                <div className="text-sm font-medium">{o.label}</div>
                <div className="text-xs text-muted-foreground">{o.description}</div>
              </div>
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuleren</Button>
          <Button onClick={() => onSave(roles)} disabled={loading}>Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkEmployeeDialog({
  initial, loading, fetchEmployees, onClose, onSave,
}: {
  initial: { userId: string; name: string; currentEmployeeId: string | null };
  loading: boolean;
  fetchEmployees: () => Promise<Array<{ id: string; first_name: string; last_name: string; function_title: string | null; user_id: string | null }>>;
  onClose: () => void;
  onSave: (employee_id: string | null) => void;
}) {
  const [selected, setSelected] = useState<string>(initial.currentEmployeeId ?? "__none__");
  const { data: employees = [] } = useQuery({
    queryKey: ["all-employees-for-linking"],
    queryFn: fetchEmployees,
  });

  const available = employees.filter((e) => !e.user_id || e.id === initial.currentEmployeeId);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Personeelsfiche koppelen</DialogTitle>
          <DialogDescription>Koppel {initial.name} aan een bestaande personeelsfiche.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Personeelsfiche</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger><SelectValue placeholder="Kies fiche" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— geen koppeling —</SelectItem>
              {available.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.last_name} {e.first_name}{e.function_title ? ` · ${e.function_title}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Alleen niet-gekoppelde fiches worden getoond. Maak eerst een fiche aan via Personeelsfiches als er niks in de lijst staat.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuleren</Button>
          <Button onClick={() => onSave(selected === "__none__" ? null : selected)} disabled={loading}>Opslaan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
