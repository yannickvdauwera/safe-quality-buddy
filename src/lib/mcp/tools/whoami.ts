import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { requireAuth, supabaseForUser } from "../supabase";

export default defineTool({
  name: "whoami",
  title: "Wie ben ik",
  description: "Toon de ingelogde gebruiker (naam, e-mail, functies) en toegewezen rollen.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input: z.infer<z.ZodObject<{}>>, ctx) => {
    const bad = requireAuth(ctx);
    if (bad) return bad;
    const sb = supabaseForUser(ctx);
    const userId = ctx.getUserId()!;
    const [profile, roles] = await Promise.all([
      sb.from("profiles").select("full_name,email,function_title,function_titles").eq("id", userId).maybeSingle(),
      sb.from("user_roles").select("role").eq("user_id", userId),
    ]);
    const payload = {
      user_id: userId,
      email: ctx.getUserEmail() ?? profile.data?.email ?? null,
      full_name: profile.data?.full_name ?? null,
      function_titles: profile.data?.function_titles ?? (profile.data?.function_title ? [profile.data.function_title] : []),
      roles: (roles.data ?? []).map((r) => r.role),
    };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
