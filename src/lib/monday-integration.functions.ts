import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequestHost, getRequestHeader } from "@tanstack/react-start/server";

const getPublishedHost = (host: string) => {
  const forwardedHost = getRequestHeader("x-forwarded-host") ?? getRequestHeader("host") ?? host;
  if (forwardedHost && !forwardedHost.includes("localhost") && !forwardedHost.includes("id-preview--")) {
    return forwardedHost;
  }
  if (host && !host.includes("localhost") && !host.includes("id-preview--")) {
    return host;
  }
  return "safe-quality-buddy.lovable.app";
};

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

    const host = getRequestHost();
    let projectId: string | null = null;
    const m = host.match(/^(?:id-preview--|project--)([0-9a-f-]+)(?:-dev)?\.lovable\.app$/i);
    if (m) projectId = m[1];

    const scheme = host.startsWith("localhost") ? "http" : "https";
    const currentUrl = `${scheme}://${host}/api/public/monday-webhook?secret=${encodeURIComponent(secret)}`;
    const publishedHost = getPublishedHost(host);
    const publishedUrl = `https://${publishedHost}/api/public/monday-webhook?secret=${encodeURIComponent(secret)}`;
    const previewUrl = projectId
      ? `https://project--${projectId}-dev.lovable.app/api/public/monday-webhook?secret=${encodeURIComponent(secret)}`
      : null;

    return {
      url: publishedUrl ?? currentUrl,
      publishedUrl,
      previewUrl,
      configured: true as const,
    };
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
