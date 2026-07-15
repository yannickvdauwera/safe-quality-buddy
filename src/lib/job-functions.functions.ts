import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

export const listJobFunctions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("job_functions")
      .select("id, name")
      .order("name");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createJobFunction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ name: z.string().trim().min(1).max(200) }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("job_functions")
      .insert({ name: data.name })
      .select("id, name")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateJobFunction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), name: z.string().trim().min(1).max(200) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await supabaseAdmin
      .from("job_functions").select("name").eq("id", data.id).maybeSingle();
    const { error } = await supabaseAdmin
      .from("job_functions").update({ name: data.name }).eq("id", data.id);
    if (error) throw new Error(error.message);
    // Rename existing references in profiles.function_titles arrays
    if (prev?.name && prev.name !== data.name) {

      const { data: profiles } = await supabaseAdmin
        .from("profiles").select("id, function_titles").contains("function_titles", [prev.name]);
      for (const p of profiles ?? []) {
        const next = (p.function_titles ?? []).map((n) => (n === prev.name ? data.name : n));
        await supabaseAdmin.from("profiles").update({ function_titles: next }).eq("id", p.id);
      }
    }
    return { ok: true };
  });

export const deleteJobFunction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("job_functions").select("name").eq("id", data.id).maybeSingle();
    const { error } = await supabaseAdmin.from("job_functions").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    if (row?.name) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles").select("id, function_titles").contains("function_titles", [row.name]);
      for (const p of profiles ?? []) {
        const next = (p.function_titles ?? []).filter((n) => n !== row.name);
        await supabaseAdmin.from("profiles").update({ function_titles: next }).eq("id", p.id);
      }
    }
    return { ok: true };
  });

// Assign functions to a user (admin or hse_manager)
export const setUserFunctionTitles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      user_id: z.string().uuid(),
      function_titles: z.array(z.string().trim().min(1).max(200)).max(20),
    }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: roles } = await context.supabase
      .from("user_roles").select("role").eq("user_id", context.userId)
      .in("role", ["admin", "hse_manager"]);
    if (!roles || roles.length === 0) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const unique = Array.from(new Set(data.function_titles));
    await supabaseAdmin.from("profiles").update({
      function_titles: unique,
      function_title: unique[0] ?? null,
    }).eq("id", data.user_id);
    return { ok: true };
  });
