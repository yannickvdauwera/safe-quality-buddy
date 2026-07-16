import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_safety_observations",
  title: "Recente MOS / STOP",
  description: "Lijst met recente veiligheidsobservaties (MOS-meldingen en STOP-reflexen) waar de gebruiker toegang toe heeft.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Aantal resultaten, standaard 10."),
    kind: z.enum(["mos", "stop", "all"]).optional().describe("Filter op type observatie."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, kind }, ctx) => {
    const bad = requireAuth(ctx);
    if (bad) return bad;
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("safety_observations")
      .select("id,type,situation_description,location,plant,status,created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);
    if (kind && kind !== "all") q = q.eq("type", kind);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { observations: data ?? [] },
    };
  },
});
