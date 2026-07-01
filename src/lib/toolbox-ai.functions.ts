import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  prompt: z.string().min(3).max(500),
  category: z.string().optional(),
});

const ContentSchema = z.object({
  title: z.string(),
  description: z.string(),
  category: z.string(),
  content: z.object({
    objective: z.string(),
    hazards: z.array(z.string()),
    measures: z.array(z.string()),
    checklist: z.array(z.string()),
    questions: z.array(z.string()),
  }),
});

export const generateToolbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("Missing LOVABLE_API_KEY");

    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");
    const { generateObject } = await import("ai");

    const gateway = createLovableAiGatewayProvider(key);
    const model = gateway("google/gemini-3-flash-preview");

    const systemPrompt = `Je bent een Belgische veiligheidsexpert (HSE) die toolboxen opstelt voor arbeiders in de petrochemie en industriële omgeving.
Antwoord ALTIJD in het Nederlands.
Formuleer beknopt, praktisch en direct toepasbaar op de werkvloer.
Elke lijst heeft 4 tot 8 items.
Vermijd algemeenheden — geef concrete voorbeelden en concrete maatregelen.`;

    const userPrompt = `Stel een toolbox samen over: ${data.prompt}${data.category ? `\nCategorie: ${data.category}` : ""}

Structuur:
- title: pakkende titel (max 80 tekens)
- description: één zin die het onderwerp beschrijft
- category: kies één van: Werken op hoogte, Besloten ruimtes, Chemische stoffen, Elektrische veiligheid, Persoonlijke beschermingsmiddelen, Brandveiligheid, Heftrucks & interne transportmiddelen, Ergonomie & tillen, Housekeeping, Noodprocedures, Algemeen
- content.objective: 1-2 zinnen wat de deelnemer moet weten na de toolbox
- content.hazards: lijst van gevaren
- content.measures: lijst van preventiemaatregelen
- content.checklist: lijst van punten om ter plaatse na te kijken
- content.questions: lijst van discussievragen om deelnemers te betrekken`;

    const { object } = await generateObject({
      model,
      schema: ContentSchema,
      system: systemPrompt,
      prompt: userPrompt,
    });

    return object;
  });
