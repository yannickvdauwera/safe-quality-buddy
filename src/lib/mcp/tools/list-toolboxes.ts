import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_toolboxes",
  title: "Toolboxen",
  description: "Lijst met beschikbare toolboxen (titel, categorie, beschrijving).",
  inputSchema: {
    limit: z.number().int().min(1).max(100).optional().describe("Aantal resultaten, standaard 20."),
    search: z.string().optional().describe("Zoekterm in titel of beschrijving."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit, search }, ctx) => {
    const bad = requireAuth(ctx);
    if (bad) return bad;
    const sb = supabaseForUser(ctx);
    let q = sb
      .from("toolboxes")
      .select("id,title,category,description,created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (search && search.trim()) {
      const s = search.trim().replace(/[%,]/g, "");
      q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%`);
    }
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { toolboxes: data ?? [] },
    };
  },
});
