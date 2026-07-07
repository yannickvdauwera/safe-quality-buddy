import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RecipientSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

const InputSchema = z.object({
  reportId: z.string().uuid(),
  subject: z.string().min(1).max(300),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),
  recipients: z.array(RecipientSchema).min(1).max(20),
  pdfBase64: z.string().min(1),
  pdfFilename: z.string().min(1).max(200),
});

export const sendReportPdfEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error(
        "E-mailversturing is niet geconfigureerd. Voeg de RESEND_API_KEY toe bij de projectinstellingen.",
      );
    }
    const from = process.env.RESEND_FROM_ADDRESS || "TSA Safety <onboarding@resend.dev>";

    // Deduplicate recipients (case-insensitive)
    const seen = new Set<string>();
    const to = data.recipients.filter((r) => {
      const k = r.email.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: to.map((r) => (r.name ? `${r.name} <${r.email}>` : r.email)),
        subject: data.subject,
        html: data.bodyHtml,
        text: data.bodyText,
        attachments: [
          {
            filename: data.pdfFilename,
            content: data.pdfBase64,
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`E-mail versturen mislukt (${res.status}): ${errText || res.statusText}`);
    }

    const json = (await res.json().catch(() => ({}))) as { id?: string };
    return {
      ok: true,
      id: json.id ?? null,
      sentTo: to.map((r) => r.email),
      reportId: data.reportId,
    };
  });
