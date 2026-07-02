import { createFileRoute } from "@tanstack/react-router";

/**
 * Monday.com webhook receiver.
 *
 * Configureer in Monday: Integrations → "When column changes / item is created" →
 * "Send webhook" naar:
 *   https://<jouw-app>/api/public/monday-webhook?secret=<MONDAY_WEBHOOK_SECRET>
 *
 * De handler:
 *  - beantwoordt Monday's `challenge` handshake
 *  - verifieert het gedeelde secret uit de query string
 *  - mapt kolommen op naam (case-insensitive) naar employees-velden
 *  - upsert op lower(email); als email ontbreekt op monday_item_id
 *  - zet active=false bij delete / status "Uit dienst"
 *  - logt elk event in monday_sync_events
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });

const text = (body: string, status = 200) =>
  new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...CORS },
  });

type MondayColumnValue = {
  id?: string;
  title?: string;
  text?: string | null;
  value?: string | null;
};

type MondayEvent = {
  type?: string;
  pulseId?: number;
  pulseName?: string;
  boardId?: number;
  columnValues?: Record<string, MondayColumnValue> | MondayColumnValue[];
  columnId?: string;
  columnTitle?: string;
  value?: unknown;
  previousValue?: unknown;
};

const norm = (s: string | undefined | null) =>
  (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Column-title → employees field mapping (fuzzy on normalised title)
const FIELD_MAP: Array<{ match: (title: string) => boolean; field: string }> = [
  { match: (t) => ["voornaam", "firstname"].includes(t), field: "first_name" },
  { match: (t) => ["naam", "achternaam", "familienaam", "lastname", "surname", "employee"].includes(t), field: "_employee_name" },
  { match: (t) => ["roepnaam", "nickname"].includes(t), field: "nickname" },
  { match: (t) => ["email", "emailadres", "mail", "mailadres", "epost"].includes(t), field: "email" },
  { match: (t) => ["telefoon", "telefoonnummer", "gsm", "phone", "mobile"].includes(t), field: "phone" },
  { match: (t) => ["functie", "functies", "function", "role", "rol", "jobtitle"].includes(t), field: "function_title" },
  { match: (t) => ["afdeling", "department", "dienst"].includes(t), field: "department" },
  { match: (t) => ["personeelsnummer", "personeelsnr", "employeenumber", "empnr", "badge"].includes(t), field: "employee_number" },
  { match: (t) => ["werkgever", "employer", "bedrijf", "company"].includes(t), field: "employer" },
  { match: (t) => ["contract", "contracttype", "typecontract"].includes(t), field: "contract_type" },
  { match: (t) => ["indienst", "indienstdatum", "startdatum", "hiredate", "startdate"].includes(t), field: "hire_date" },
  { match: (t) => ["uitdienst", "einddatum", "enddate"].includes(t), field: "end_date" },
  { match: (t) => ["status"].includes(t), field: "_status" },
];

function extractText(col: MondayColumnValue): string | null {
  if (col.text && col.text.trim() !== "") return col.text.trim();
  if (!col.value) return null;
  try {
    const v = typeof col.value === "string" ? JSON.parse(col.value) : col.value;
    if (typeof v === "string") return v;
    if (v && typeof v === "object") {
      const anyV = v as Record<string, unknown>;
      if (typeof anyV.email === "string") return anyV.email;
      if (typeof anyV.text === "string") return anyV.text;
      if (typeof anyV.label === "string") return anyV.label;
      if (typeof anyV.phone === "string") return anyV.phone;
      if (typeof anyV.date === "string") return anyV.date;
    }
  } catch {
    /* fall through */
  }
  return null;
}

function mapColumnsToFields(
  columns: Record<string, MondayColumnValue> | MondayColumnValue[] | undefined,
): Record<string, string | null> {
  const out: Record<string, string | null> = {};
  if (!columns) return out;
  const list = Array.isArray(columns) ? columns : Object.values(columns);
  for (const col of list) {
    const title = norm(col.title);
    if (!title) continue;
    const mapping = FIELD_MAP.find((m) => m.match(title));
    if (!mapping) continue;
    out[mapping.field] = extractText(col);
  }
  return out;
}

function parseEmployeeName(name: string | undefined): { first_name?: string; last_name?: string } {
  if (!name) return {};
  const trimmed = name.trim();
  // Preferred Monday format: "Achternaam, Voornaam"
  if (trimmed.includes(",")) {
    const [last, ...firstParts] = trimmed.split(",");
    const first = firstParts.join(",").trim();
    return { last_name: last.trim() || undefined, first_name: first || undefined };
  }
  // Fallback: "Voornaam Achternaam"
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { last_name: parts[0] };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

export const Route = createFileRoute("/api/public/monday-webhook")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),

      POST: async ({ request }) => {
        const rawBody = await request.text();
        let body: { challenge?: string; event?: MondayEvent } = {};
        try {
          body = rawBody ? JSON.parse(rawBody) : {};
        } catch {
          return json({ error: "Invalid JSON" }, 400);
        }

        // Monday's webhook verification sometimes calls the URL before sending
        // the configured query string. The challenge only proves reachability and
        // never writes data, so answer it before enforcing the shared secret.
        if (body.challenge) {
          const accept = request.headers.get("accept") ?? "";
          if (!accept.includes("application/json")) {
            return text(body.challenge);
          }
          return json({ challenge: body.challenge });
        }

        const secret = process.env.MONDAY_WEBHOOK_SECRET;
        if (!secret) return json({ error: "Server not configured" }, 500);

        const url = new URL(request.url);
        const provided = url.searchParams.get("secret") ?? request.headers.get("x-webhook-secret");
        if (provided !== secret) return json({ error: "Unauthorized" }, 401);

        const event = body.event;
        if (!event) return json({ ok: true, ignored: "no event" });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const eventType = event.type ?? "unknown";
        const itemId = event.pulseId ?? null;
        const boardId = event.boardId ?? null;

        const logResult = async (status: string, employeeId: string | null, error?: string) => {
          await supabaseAdmin.from("monday_sync_events").insert({
            event_type: eventType,
            monday_item_id: itemId,
            monday_board_id: boardId,
            employee_id: employeeId,
            status,
            error: error ?? null,
            payload: body as never,
          });
        };

        try {
          // Item deleted OR moved to another board → deactivate the employee
          const isDeactivationEvent =
            eventType === "delete_pulse" ||
            eventType === "item_deleted" ||
            eventType === "move_pulse_into_board" ||
            eventType === "item_moved_to_any_board" ||
            eventType === "item_moved_to_specific_board";
          if (isDeactivationEvent) {
            if (itemId) {
              const { data } = await supabaseAdmin
                .from("employees")
                .update({ active: false, end_date: new Date().toISOString().slice(0, 10) })
                .eq("monday_item_id", itemId)
                .select("id")
                .maybeSingle();
              await logResult("deactivated", data?.id ?? null);
            } else {
              await logResult("ignored", null, `${eventType} without pulseId`);
            }
            return json({ ok: true });
          }

          const mapped = mapColumnsToFields(event.columnValues);

          // Column-change event: only the changed column is present → merge into mapped
          if (eventType === "update_column_value" && event.columnTitle) {
            const title = norm(event.columnTitle);
            const mapping = FIELD_MAP.find((m) => m.match(title));
            if (mapping) {
              const col: MondayColumnValue = {
                title: event.columnTitle,
                value: typeof event.value === "string" ? event.value : JSON.stringify(event.value ?? null),
              };
              mapped[mapping.field] = extractText(col);
            }
          }

          // Employee-column value (e.g. "Zardoua, Saïd") also parses as "Last, First"
          const employeeNameField = mapped._employee_name ?? null;
          delete mapped._employee_name;
          const nameParts = parseEmployeeName(employeeNameField ?? event.pulseName);

          const email = (mapped.email ?? "").trim().toLowerCase() || null;
          const status = mapped._status ?? null;
          delete mapped._status;

          const active = !status || !/uit\s*dienst|inactief|inactive|left/i.test(status);

          const payload: Record<string, unknown> = {
            ...mapped,
            email,
            first_name: mapped.first_name || nameParts.first_name || undefined,
            last_name: nameParts.last_name || undefined,
            monday_item_id: itemId,
            monday_board_id: boardId,
            last_synced_at: new Date().toISOString(),
            active,
          };
          // Strip nulls/undefined for keys we don't want to overwrite blindly except email
          for (const k of Object.keys(payload)) {
            if (payload[k] === undefined) delete payload[k];
          }

          // Look up existing employee: prefer monday_item_id, then email
          let existingId: string | null = null;
          if (itemId) {
            const { data } = await supabaseAdmin
              .from("employees")
              .select("id")
              .eq("monday_item_id", itemId)
              .maybeSingle();
            existingId = data?.id ?? null;
          }
          if (!existingId && email) {
            const { data } = await supabaseAdmin
              .from("employees")
              .select("id")
              .ilike("email", email)
              .maybeSingle();
            existingId = data?.id ?? null;
          }

          if (!existingId && !email && !payload.last_name) {
            await logResult("ignored", null, "no email and no name to identify employee");
            return json({ ok: true, ignored: "insufficient data" });
          }

          if (existingId) {
            const { error } = await supabaseAdmin
              .from("employees")
              .update(payload as never)
              .eq("id", existingId);
            if (error) throw error;
            await logResult("updated", existingId);
            return json({ ok: true, action: "updated", id: existingId });
          }

          // Insert path: ensure required NOT NULL fields have a fallback
          const insertPayload = {
            first_name: (payload.first_name as string) ?? "—",
            last_name: (payload.last_name as string) ?? "—",
            ...payload,
          };
          const { data, error } = await supabaseAdmin
            .from("employees")
            .insert(insertPayload as never)
            .select("id")
            .single();
          if (error) throw error;
          await logResult("created", data.id);
          return json({ ok: true, action: "created", id: data.id });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          await logResult("error", null, message);
          return json({ error: message }, 500);
        }
      },
    },
  },
});
