import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const SignInputSchema = z.object({
  token: z.string().min(8).max(100),
  employee_id: z.string().uuid(),
  signature_data: z.string().startsWith("data:image/").max(200000),
});

export const Route = createFileRoute("/api/public/toolbox-sign")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = url.searchParams.get("token");
        if (!token) return new Response("Missing token", { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: session, error } = await supabaseAdmin
          .from("toolbox_sessions")
          .select("id, toolbox_id, version_id, status, location, scheduled_at, given_at")
          .eq("signing_token", token)
          .maybeSingle();

        if (error || !session) return new Response("Onbekende link", { status: 404 });
        if (session.status === "cancelled")
          return Response.json({ error: "Deze sessie is geannuleerd." }, { status: 410 });

        const [{ data: toolbox }, { data: version }, { data: parts }, { data: sigs }] = await Promise.all([
          supabaseAdmin.from("toolboxes").select("id, title, description, category").eq("id", session.toolbox_id).maybeSingle(),
          supabaseAdmin.from("toolbox_versions").select("id, version_number, content").eq("id", session.version_id).maybeSingle(),
          supabaseAdmin.from("toolbox_session_participants").select("employee_id, employees(id, full_name, function_title)").eq("session_id", session.id),
          supabaseAdmin.from("toolbox_signatures").select("employee_id, signed_at").eq("session_id", session.id),
        ]);

        const signed = new Set((sigs ?? []).map((s) => s.employee_id));
        const participants = (parts ?? []).map((p) => {
          const emp = p.employees as unknown as { id: string; full_name: string; function_title: string | null } | null;
          return {
            employee_id: p.employee_id,
            full_name: emp?.full_name ?? "—",
            function_title: emp?.function_title ?? null,
            signed: signed.has(p.employee_id),
          };
        });

        return Response.json({ session, toolbox, version, participants });
      },
      POST: async ({ request }) => {
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }
        const parse = SignInputSchema.safeParse(body);
        if (!parse.success) return Response.json({ error: "Ongeldige invoer" }, { status: 400 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: session, error: sessErr } = await supabaseAdmin
          .from("toolbox_sessions")
          .select("id, status")
          .eq("signing_token", parse.data.token)
          .maybeSingle();
        if (sessErr || !session) return Response.json({ error: "Onbekende link" }, { status: 404 });
        if (session.status === "cancelled") return Response.json({ error: "Sessie geannuleerd" }, { status: 410 });

        // employee must be a participant
        const { data: part } = await supabaseAdmin
          .from("toolbox_session_participants")
          .select("employee_id")
          .eq("session_id", session.id)
          .eq("employee_id", parse.data.employee_id)
          .maybeSingle();
        if (!part) return Response.json({ error: "Niet uitgenodigd voor deze sessie" }, { status: 403 });

        const { error: insertErr } = await supabaseAdmin
          .from("toolbox_signatures")
          .insert({
            session_id: session.id,
            employee_id: parse.data.employee_id,
            signature_data: parse.data.signature_data,
            sign_method: "qr",
          });
        if (insertErr) {
          if (insertErr.code === "23505") return Response.json({ error: "Al getekend" }, { status: 409 });
          return Response.json({ error: "Kon niet opslaan" }, { status: 500 });
        }
        return Response.json({ ok: true });
      },
    },
  },
});
