import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHost } from "@tanstack/react-start/server";

export const getMondayWebhookUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Only admins may see the URL (it contains the shared secret)
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const secret = process.env.MONDAY_WEBHOOK_SECRET;
    if (!secret) {
      return { url: null as string | null, configured: false as const };
    }

    // Prefer the stable published URL when we're on a *.lovable.app host,
    // otherwise fall back to the current host (works in preview too).
    const host = getRequestHost();
    const scheme = host.startsWith("localhost") ? "http" : "https";
    const base = `${scheme}://${host}`;
    const url = `${base}/api/public/monday-webhook?secret=${encodeURIComponent(secret)}`;

    return { url, configured: true as const };
  });

export const getMondaySyncEvents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (!isAdmin) throw new Error("Forbidden");

    const { data, error } = await context.supabase
      .from("monday_sync_events")
      .select("id, received_at, event_type, status, error, monday_item_id, employee_id")
      .order("received_at", { ascending: false })
      .limit(25);
    if (error) throw error;
    return data ?? [];
  });
