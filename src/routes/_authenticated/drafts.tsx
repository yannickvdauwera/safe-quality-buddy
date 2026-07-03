import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileEdit, Trash2 } from "lucide-react";

const FORM_TYPE_LABELS: Record<string, string> = {
  "melding:mos": "MOS-melding",
  "melding:stop": "STOP-reflex",
  "melding:klacht": "Interne melding",
  "melding:ao_ehbo": "(Bijna)ongeval / EHBO",
  "inspectie:wpi": "Werkplekinspectie",
  "inspectie:kwaliteit": "Kwaliteitscontrole",
  evaluation: "Evaluatie",
};

function labelFor(t: string) {
  if (FORM_TYPE_LABELS[t]) return FORM_TYPE_LABELS[t];
  if (t.startsWith("melding:")) return `Melding — ${t.slice(8)}`;
  if (t.startsWith("inspectie:")) return `Inspectie — ${t.slice(10)}`;
  return t;
}

function DraftsPage() {
  const qc = useQueryClient();
  const { data: drafts = [], isLoading } = useQuery({
    queryKey: ["form-drafts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_drafts")
        .select("id, form_type, form_key, title, last_saved_at, updated_at")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const remove = async (id: string) => {
    if (!confirm("Dit concept definitief verwijderen?")) return;
    const { error } = await supabase.from("form_drafts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Concept verwijderd");
    qc.invalidateQueries({ queryKey: ["form-drafts"] });
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <FileEdit className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold">Mijn concepten</h1>
          <p className="text-sm text-muted-foreground">
            Niet-verzonden formulieren worden hier bewaard. Open het bijbehorend formulier om verder te
            werken; het concept wordt automatisch aangeboden.
          </p>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laden…</p>
      ) : drafts.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Je hebt momenteel geen concepten.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {drafts.map((d) => (
            <Card key={d.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{d.title ?? "Naamloos concept"}</CardTitle>
                  <Badge variant="secondary">{labelFor(d.form_type)}</Badge>
                </div>
              </CardHeader>
              <CardContent className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  Laatst opgeslagen · {new Date(d.last_saved_at).toLocaleString("nl-BE")}
                </span>
                <Button variant="ghost" size="sm" onClick={() => remove(d.id)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Verwijderen
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/drafts")({
  component: DraftsPage,
});
