import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_recent_reports",
  title: "Recente meldingen",
  description: "Lijst met recente interne meldingen en (bijna-)ongevallen waar de gebruiker toegang toe heeft (RLS).",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Aantal resultaten, standaard 10."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    const bad = requireAuth(ctx);
    if (bad) return bad;
    const sb = supabaseForUser(ctx);
    const { data, error } = await sb
      .from("reports")
      .select("id,type,title,severity,status,location,created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { reports: data ?? [] },
    };
  },
});
