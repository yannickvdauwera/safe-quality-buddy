import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Copy, Check, RefreshCw, ExternalLink, AlertCircle } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getMondayWebhookUrl,
  getMondaySyncEvents,
} from "@/lib/monday-integration.functions";

export const Route = createFileRoute("/_authenticated/integraties/monday")({
  component: MondayIntegrationPage,
});

function MondayIntegrationPage() {
  const fetchUrl = useServerFn(getMondayWebhookUrl);
  const fetchEvents = useServerFn(getMondaySyncEvents);
  const [copied, setCopied] = useState(false);

  const urlQuery = useQuery({
    queryKey: ["monday-webhook-url"],
    queryFn: () => fetchUrl({}),
  });

  const eventsQuery = useQuery({
    queryKey: ["monday-sync-events"],
    queryFn: () => fetchEvents({}),
    refetchInterval: 5000,
  });

  const url = urlQuery.data?.url ?? "";
  const events = eventsQuery.data ?? [];

  const copy = async () => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Webhook-URL gekopieerd");
    setTimeout(() => setCopied(false), 2000);
  };

  const recipes = [
    { trigger: "When an item is created", action: "Nieuwe medewerker wordt aangemaakt" },
    { trigger: "When a column changes", action: "Wijzigingen aan telefoon, email, functie, … worden gesynchroniseerd" },
    { trigger: "When an item is moved to any board", action: "Medewerker wordt op inactief gezet (uit dienst)" },
    { trigger: "When an item is deleted", action: "Medewerker wordt op inactief gezet" },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-8 p-6">
        <div>
          <h1 className="text-3xl font-serif font-medium tracking-tight">Monday-integratie</h1>
          <p className="mt-2 text-muted-foreground">
            Synchroniseer je HR-bord in Monday.com automatisch met de module Personeelsfiches.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Webhook-URL</CardTitle>
            <CardDescription>
              Plak deze URL in elk Monday-recept hieronder. Bevat het secret — deel niet buiten je organisatie.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {urlQuery.isLoading && <div className="text-sm text-muted-foreground">Laden…</div>}
            {urlQuery.data && !urlQuery.data.configured && (
              <div className="flex items-start gap-2 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>Er is nog geen MONDAY_WEBHOOK_SECRET geconfigureerd in de backend.</div>
              </div>
            )}
            {url && (
              <div className="flex gap-2">
                <Input value={url} readOnly className="font-mono text-xs" />
                <Button onClick={copy} variant="secondary" className="shrink-0">
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Gekopieerd" : "Kopieer"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stappenplan in Monday</CardTitle>
            <CardDescription>Uit te voeren op je HR-bord (bv. "1.1.1 Workforce").</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal space-y-3 pl-6 text-sm">
              <li>Open je HR-bord in Monday en klik rechtsboven op <strong>Integrate</strong>.</li>
              <li>Zoek op <strong>Webhooks</strong> en kies <em>"Add to board"</em>.</li>
              <li>
                Voeg de volgende <strong>vier recepten</strong> toe. Plak in elk recept dezelfde
                URL uit het vak hierboven.
              </li>
            </ol>

            <div className="space-y-2">
              {recipes.map((r) => (
                <div
                  key={r.trigger}
                  className="flex items-start justify-between gap-4 rounded-2xl border bg-surface-container p-4"
                >
                  <div>
                    <div className="font-medium">{r.trigger}</div>
                    <div className="text-sm text-muted-foreground">→ {r.action}</div>
                  </div>
                  <Badge variant="secondary" className="shrink-0">Vereist</Badge>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-primary/5 p-4 text-sm">
              <strong>Kolom-mapping.</strong> De itemnaam wordt gelezen als <em>Achternaam, Voornaam</em>.
              Herkende kolomtitels: Email, Telefoon/GSM, Functie(s), Werkgever, Afdeling, Personeelsnr,
              Contract, Indienstdatum, Uitdienstdatum, Status. Andere kolommen worden genegeerd.
            </div>

            <a
              href="https://support.monday.com/hc/en-us/articles/360003540679-The-Webhooks-Integration"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Monday-documentatie voor webhooks <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recente sync-events</CardTitle>
              <CardDescription>Laatste 25 binnenkomende Monday-events. Ververst automatisch.</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => eventsQuery.refetch()}
              disabled={eventsQuery.isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${eventsQuery.isFetching ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {events.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Nog geen events ontvangen. Wijzig een item op je Monday-bord en het verschijnt hier.
              </div>
            ) : (
              <div className="space-y-2">
                {events.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-4 rounded-xl border bg-surface-container/50 p-3 text-sm"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{e.event_type}</span>
                        <StatusBadge status={e.status} />
                      </div>
                      {e.error && <div className="mt-1 truncate text-xs text-destructive">{e.error}</div>}
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      {new Date(e.received_at).toLocaleString("nl-BE")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    created: "default",
    updated: "secondary",
    deactivated: "outline",
    ignored: "outline",
    error: "destructive",
  };
  return <Badge variant={variants[status] ?? "outline"}>{status}</Badge>;
}
