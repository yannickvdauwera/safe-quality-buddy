import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { ReportsList } from "@/components/ReportsList";
import { MeldingCreateForm } from "@/components/MeldingCreateForm";

export const Route = createFileRoute("/_authenticated/meldingen")({
  head: () => ({ meta: [{ title: "Meldingen — HSE & Kwaliteit" }] }),
  component: MeldingenPage,
});

const TYPES = [
  { value: "ao_ehbo", label: "Arbeidsongeval / EHBO" },
  { value: "klacht", label: "Interne klacht / incident" },
  { value: "kwaliteit", label: "Kwaliteitscontrole" },
  { value: "andere", label: "Andere melding" },
];

function MeldingenPage() {
  return (
    <ReportsList
      queryKey="reports-meldingen"
      title="Meldingen"
      description="Interne meldingen: arbeidsongevallen/EHBO, klachten, kwaliteitscontroles en overige vaststellingen. Het formulier past zich aan op basis van het gekozen type."
      newLabel="Nieuwe melding"
      singularNoun="melding"
      icon={AlertTriangle}
      typeOptions={TYPES}
      defaultType="ao_ehbo"
      CreateFormComponent={MeldingCreateForm}
    />
  );
}
