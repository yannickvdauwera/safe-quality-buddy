import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { ReportsList } from "@/components/ReportsList";

export const Route = createFileRoute("/_authenticated/meldingen")({
  head: () => ({ meta: [{ title: "Meldingen — HSE & Kwaliteit" }] }),
  component: MeldingenPage,
});

const TYPES = [
  { value: "ao_ehbo", label: "Arbeidsongeval / EHBO" },
  { value: "kwaliteit", label: "Kwaliteitscontrole" },
  { value: "klacht", label: "Klacht" },
  { value: "andere", label: "Andere melding" },
];

function MeldingenPage() {
  return (
    <ReportsList
      queryKey="reports-meldingen"
      title="Meldingen"
      description="Interne meldingen: arbeidsongevallen, kwaliteitscontroles, klachten en andere vaststellingen. Voor MOS en STOP-reflexen zijn er aparte modules."
      newLabel="Nieuwe melding"
      singularNoun="melding"
      icon={AlertTriangle}
      typeOptions={TYPES}
      defaultType="ao_ehbo"
    />
  );
}
