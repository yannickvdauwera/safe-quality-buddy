import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";

// The Supabase JS client exposes auth.oauth as beta; wrap the three methods we call.
type OAuthDetails = {
  client?: { name?: string; client_name?: string; logo_uri?: string; client_uri?: string } | null;
  redirect_url?: string;
  redirect_to?: string;
  scope?: string;
  scopes?: string[];
};
type OAuthResult = { redirect_url?: string; redirect_to?: string };
interface OAuthNamespace {
  getAuthorizationDetails(id: string): Promise<{ data: OAuthDetails | null; error: { message: string } | null }>;
  approveAuthorization(id: string): Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
  denyAuthorization(id: string): Promise<{ data: OAuthResult | null; error: { message: string } | null }>;
}
function oauth(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Ontbrekend authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  errorComponent: ({ error }) => (
    <main className="min-h-screen flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>Autorisatieverzoek kon niet geladen worden</CardTitle>
          <CardDescription className="pt-2">{String((error as Error)?.message ?? error)}</CardDescription>
        </CardHeader>
      </Card>
    </main>
  ),
  component: Consent,
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "een externe applicatie";
  const scopes = details?.scopes ?? (details?.scope ? details.scope.split(/\s+/).filter(Boolean) : []);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const call = approve ? oauth().approveAuthorization : oauth().denyAuthorization;
    const { data, error } = await call(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("Geen redirect-URL ontvangen.");
      return;
    }
    window.location.href = target;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary text-primary-foreground mb-3">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-semibold tracking-tight">HSE & Kwaliteit koppelen</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Verbind {clientName} met je account</CardTitle>
            <CardDescription className="pt-2">
              Dit laat {clientName} deze app gebruiken als jou. De toegang volgt jouw rechten (RLS) —
              er wordt niets bereikbaar dat je zelf ook niet kan zien of doen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {scopes.length > 0 && (
              <div className="text-sm">
                <div className="font-medium mb-1">Gevraagde rechten</div>
                <ul className="list-disc pl-5 text-muted-foreground space-y-0.5">
                  {scopes.map((s: string) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            )}
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={() => decide(true)} disabled={busy} className="w-full">
                Verbinden goedkeuren
              </Button>
              <Button
                onClick={() => decide(false)}
                disabled={busy}
                variant="outline"
                className="w-full"
              >
                Weigeren
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
