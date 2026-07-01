import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { ReportsList } from "@/components/ReportsList";
import { MeldingCreateForm } from "@/components/MeldingCreateForm";

export const Route = createFileRoute("/_authenticated/meldingen/ongevallen")({
  head: () => ({ meta: [{ title: "(Bijna)ongevallen — HSE & Kwaliteit" }] }),
  component: OngevallenPage,
});

const TYPES = [
  { value: "ao_ehbo", label: "Arbeidsongeval / EHBO" },
];

function OngevallenPage() {
  return (
    <ReportsList
      queryKey="reports-meldingen-ongevallen"
      title="(Bijna)ongevallen"
      description="Arbeidsongevallen, EHBO-interventies en bijna-ongevallen — met volledig ongevallenonderzoek."
      newLabel="Nieuw (bijna)ongeval"
      singularNoun="ongeval"
      icon={AlertTriangle}
      typeOptions={TYPES}
      defaultType="ao_ehbo"
      CreateFormComponent={MeldingCreateForm}
    />
  );
}
