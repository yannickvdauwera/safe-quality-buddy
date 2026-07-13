import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const APP_ROLES = ["admin", "hse_manager", "manager", "operator"] as const;
type AppRole = (typeof APP_ROLES)[number];

async function assertAdmin(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Response("Forbidden", { status: 403 });
}

// Returns 'admin' if the caller is admin, 'hse_manager' if only hse_manager,
// otherwise throws 403. Used by the Medewerkers module so HSE-managers can
// manage operator/manager accounts, without gaining admin privileges.
async function assertWorkerManager(
  supabase: SupabaseClient,
  userId: string,
): Promise<"admin" | "hse_manager"> {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "hse_manager"]);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r) => r.role);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("hse_manager")) return "hse_manager";
  throw new Response("Forbidden", { status: 403 });
}

const WORKER_ROLES = new Set<AppRole>(["operator", "manager"]);

export const listUsersWithRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authList, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authErr) throw new Error(authErr.message);

    const userIds = authList.users.map((u) => u.id);
    const [{ data: profiles }, { data: roles }, { data: employees }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email, avatar_url").in("id", userIds),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", userIds),
      supabaseAdmin.from("employees").select("id, first_name, last_name, user_id").in("user_id", userIds),
    ]);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesByUser.set(r.user_id, arr);
    }
    const empByUser = new Map(employees?.map((e) => [e.user_id!, e]) ?? []);

    return authList.users
      .map((u) => {
        const p = profileMap.get(u.id);
        const emp = empByUser.get(u.id);
        return {
          id: u.id,
          email: u.email ?? p?.email ?? null,
          full_name: p?.full_name ?? (u.user_metadata as any)?.full_name ?? null,
          avatar_url: p?.avatar_url ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          email_confirmed_at: u.email_confirmed_at ?? null,
          roles: rolesByUser.get(u.id) ?? [],
          employee: emp ? { id: emp.id, name: `${emp.first_name} ${emp.last_name}` } : null,
        };
      })
      .sort((a, b) => (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? ""));
  });

export const setUserRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      roles: z.array(z.enum(APP_ROLES)),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId && !data.roles.includes("admin")) {
      throw new Error("Je kan je eigen admin-rol niet verwijderen.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id);
    if (delErr) throw new Error(delErr.message);

    if (data.roles.length > 0) {
      const { error: insErr } = await supabaseAdmin
        .from("user_roles")
        .insert(data.roles.map((role) => ({ user_id: data.user_id, role })));
      if (insErr) throw new Error(insErr.message);
    }
    return { ok: true };
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      email: z.string().trim().email().max(255),
      full_name: z.string().trim().min(1).max(100),
      roles: z.array(z.enum(APP_ROLES)).min(1),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    const newUserId = created.user?.id;
    if (!newUserId) throw new Error("Aanmaken gebruiker mislukt.");

    // handle_new_user trigger creates a default 'operator' role; replace with requested set
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert(data.roles.map((role) => ({ user_id: newUserId, role })));
    if (insErr) throw new Error(insErr.message);

    return { ok: true, user_id: newUserId };
  });

export const linkEmployee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      employee_id: z.string().uuid().nullable(),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Clear any current link for this user first (user_id could be set on another row)
    await supabaseAdmin.from("employees").update({ user_id: null }).eq("user_id", data.user_id);

    if (data.employee_id) {
      const { error } = await supabaseAdmin
        .from("employees")
        .update({ user_id: data.user_id })
        .eq("id", data.employee_id);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listUnlinkedEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("employees")
      .select("id, first_name, last_name, function_title, user_id")
      .order("last_name");
    if (error) throw new Error(error.message);
    return data;
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Je kan je eigen account niet verwijderen.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("employees").update({ user_id: null }).eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* -------- Medewerkers module (operator/manager) -------- */
// Accessible by admin OR hse_manager. Non-admin callers can only
// touch users whose current roles are a subset of {operator, manager},
// and can only assign roles from that same set.

export const listWorkers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertWorkerManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: authList, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (authErr) throw new Error(authErr.message);

    const userIds = authList.users.map((u) => u.id);
    const [{ data: profiles }, { data: roles }, { data: employees }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, email, function_title").in("id", userIds),
      supabaseAdmin.from("user_roles").select("user_id, role").in("user_id", userIds),
      supabaseAdmin.from("employees").select("id, first_name, last_name, employer, user_id, active").in("user_id", userIds),
    ]);

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of roles ?? []) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role as AppRole);
      rolesByUser.set(r.user_id, arr);
    }
    const empByUser = new Map(employees?.map((e) => [e.user_id!, e]) ?? []);

    return authList.users
      .map((u) => {
        const p = profileMap.get(u.id);
        const emp = empByUser.get(u.id);
        const userRoles = rolesByUser.get(u.id) ?? [];
        return {
          id: u.id,
          email: u.email ?? p?.email ?? null,
          full_name: p?.full_name ?? (u.user_metadata as any)?.full_name ?? null,
          function_title: p?.function_title ?? null,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at ?? null,
          email_confirmed_at: u.email_confirmed_at ?? null,
          roles: userRoles,
          employee: emp
            ? { id: emp.id, name: `${emp.first_name} ${emp.last_name}`, employer: emp.employer, active: emp.active }
            : null,
        };
      })
      // Only workers: users with operator or manager role and NO elevated role
      .filter((u) =>
        u.roles.length > 0 &&
        u.roles.every((r) => WORKER_ROLES.has(r)),
      )
      .sort((a, b) => (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? ""));
  });

async function assertTargetIsWorker(
  supabaseAdmin: SupabaseClient,
  callerLevel: "admin" | "hse_manager",
  targetUserId: string,
) {
  if (callerLevel === "admin") return;
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", targetUserId);
  const targetRoles = (data ?? []).map((r) => r.role as AppRole);
  if (targetRoles.length === 0) return; // brand-new invite
  const allWorker = targetRoles.every((r) => WORKER_ROLES.has(r));
  if (!allWorker) throw new Response("Forbidden", { status: 403 });
}

export const inviteWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      email: z.string().trim().email().max(255),
      full_name: z.string().trim().min(1).max(100),
      role: z.enum(["operator", "manager"]),
      function_title: z.string().trim().max(200).optional().or(z.literal("")),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertWorkerManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, {
      data: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    const newUserId = created.user?.id;
    if (!newUserId) throw new Error("Aanmaken gebruiker mislukt.");

    // Replace the default operator role from handle_new_user trigger with the requested one
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert([{ user_id: newUserId, role: data.role }]);
    if (insErr) throw new Error(insErr.message);

    if (data.function_title) {
      await supabaseAdmin.from("profiles").update({ function_title: data.function_title }).eq("id", newUserId);
    }
    return { ok: true, user_id: newUserId };
  });

export const setWorkerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      role: z.enum(["operator", "manager"]),
    }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const level = await assertWorkerManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertTargetIsWorker(supabaseAdmin, level, data.user_id);

    if (data.user_id === context.userId) {
      throw new Error("Je kan je eigen rol niet aanpassen via deze module.");
    }
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert([{ user_id: data.user_id, role: data.role }]);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWorker = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const level = await assertWorkerManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertTargetIsWorker(supabaseAdmin, level, data.user_id);
    if (data.user_id === context.userId) {
      throw new Error("Je kan je eigen account niet verwijderen.");
    }
    await supabaseAdmin.from("employees").update({ user_id: null }).eq("user_id", data.user_id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.user_id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Create a minimal employee fiche and link it to the given user, so
// evaluations, sessies, etc. keep werken. Returns the employee id.
export const ensureEmployeeForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ user_id: z.string().uuid() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    const level = await assertWorkerManager(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await assertTargetIsWorker(supabaseAdmin, level, data.user_id);

    const { data: existing } = await supabaseAdmin
      .from("employees")
      .select("id")
      .eq("user_id", data.user_id)
      .maybeSingle();
    if (existing) return { employee_id: existing.id };

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, function_title")
      .eq("id", data.user_id)
      .maybeSingle();

    const fullName = (profile?.full_name ?? profile?.email ?? "Onbekend").trim();
    const parts = fullName.split(/\s+/);
    const first = parts[0] ?? "Onbekend";
    const last = parts.slice(1).join(" ") || "—";

    const { data: created, error } = await supabaseAdmin
      .from("employees")
      .insert({
        first_name: first,
        last_name: last,
        email: profile?.email ?? null,
        function_title: profile?.function_title ?? null,
        user_id: data.user_id,
        active: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { employee_id: created.id };
  });
