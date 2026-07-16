import { auth, defineMcp } from "@lovable.dev/mcp-js";
import whoamiTool from "./tools/whoami";
import listRecentReportsTool from "./tools/list-recent-reports";
import listSafetyObservationsTool from "./tools/list-safety-observations";
import listToolboxesTool from "./tools/list-toolboxes";

// The OAuth issuer MUST be the direct Supabase host (not the .lovable.cloud proxy)
// — mcp-js verifies discovery matches this exactly (RFC 8414). Read the project
// ref from the Vite-inlined env; the fallback keeps the issuer well-formed during
// the manifest-extract eval, and no real token will ever verify against it.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "hse-kwaliteit-mcp",
  title: "HSE & Kwaliteit",
  version: "0.1.0",
  instructions:
    "Tools voor het HSE- en kwaliteitsbeheerplatform. Gebruik `whoami` om te controleren wie er is ingelogd. Gebruik `list_recent_reports`, `list_safety_observations` en `list_toolboxes` om data op te vragen; alle tools volgen de rechten (RLS) van de ingelogde gebruiker.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoamiTool, listRecentReportsTool, listSafetyObservationsTool, listToolboxesTool],
});
