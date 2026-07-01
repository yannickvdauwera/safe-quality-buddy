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
