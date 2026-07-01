import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HSE & Kwaliteitsbeheer — Platform" },
      { name: "description", content: "Beheer procedures, meldingen, toolboxen en risicoanalyses in één centraal platform." },
      { property: "og:title", content: "HSE & Kwaliteitsbeheer — Platform" },
      { property: "og:description", content: "Beheer procedures, meldingen, toolboxen en risicoanalyses in één centraal platform." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      navigate({ to: data.session ? "/dashboard" : "/auth", replace: true });
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground mb-4">
          <ShieldCheck className="w-7 h-7" />
        </div>
        <div className="text-sm text-muted-foreground">Bezig met laden…</div>
      </div>
    </div>
  );
}
