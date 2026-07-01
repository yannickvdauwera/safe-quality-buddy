import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { ReportsList } from "@/components/ReportsList";
import { MeldingCreateForm } from "@/components/MeldingCreateForm";

export const Route = createFileRoute("/_authenticated/meldingen/intern")({
  head: () => ({ meta: [{ title: "Interne meldingen — HSE & Kwaliteit" }] }),
  component: InterneMeldingenPage,
});

const TYPES = [
  { value: "klacht", label: "Interne klacht / incident" },
  { value: "andere", label: "Andere melding" },
];

function InterneMeldingenPage() {
  return (
    <ReportsList
      queryKey="reports-meldingen-intern"
      title="Interne meldingen"
      description="Interne klachten, incidenten en overige vaststellingen die opvolging vereisen."
      newLabel="Nieuwe interne melding"
      singularNoun="melding"
      icon={AlertTriangle}
      typeOptions={TYPES}
      defaultType="klacht"
      CreateFormComponent={MeldingCreateForm}
    />
  );
}
