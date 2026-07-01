import { createFileRoute, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2 } from "lucide-react";
import { SafetyObservationWizard } from "@/components/SafetyObservationWizard";
import { TYPE_LABELS, type SafetyObservationType } from "@/lib/safety-observations";
import tsaLogoUrl from "@/assets/tsa-logo.png";

export const Route = createFileRoute("/report/$type")({
  head: () => ({
    meta: [
      { title: "Melding indienen — TSA Safety" },
      { name: "description", content: "Dien een MOS-melding of STOP-reflex in bij TSA Safety." },
    ],
  }),
  loader: ({ params }) => {
    if (params.type !== "mos" && params.type !== "stop") throw notFound();
    return { type: params.type as SafetyObservationType };
  },
  errorComponent: ({ error }) => (
    <div className="min-h-screen grid place-items-center p-6">
      <p className="text-sm text-destructive">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="min-h-screen grid place-items-center p-6">
      <p className="text-sm text-muted-foreground">Onbekend meldingstype.</p>
    </div>
  ),
  component: PublicReportPage,
});

function PublicReportPage() {
  const { type } = Route.useLoaderData();
  const label = TYPE_LABELS[type];
  const [done, setDone] = useState(false);

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="bg-[#1A1A1A] text-white">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src={tsaLogoUrl} alt="TSA Safety" className="h-8 w-auto" />
          <div className="ml-auto text-right">
            <div className="text-xs uppercase tracking-wide text-white/60">Melding</div>
            <div className="text-sm font-semibold">{label.title}</div>
          </div>
        </div>
        <div className="h-1 bg-[#E30613]" />
      </header>

      <main className="max-w-3xl mx-auto p-6">
        <Card className="p-6">
          {done ? (
            <div className="text-center py-8 space-y-4">
              <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
              <h1 className="text-xl font-semibold">Bedankt voor je melding</h1>
              <p className="text-sm text-muted-foreground">
                Je {label.title.toLowerCase()} is doorgestuurd naar het HSE-team.
              </p>
              <Button onClick={() => setDone(false)}>Nieuwe melding indienen</Button>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold mb-1">Nieuwe {label.title}</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Vul dit formulier in — geen account nodig.
              </p>
              <SafetyObservationWizard
                type={type}
                mode="public"
                onDone={() => setDone(true)}
              />
            </>
          )}
        </Card>
      </main>
    </div>
  );
}
