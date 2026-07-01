import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { ReportsList } from "@/components/ReportsList";
import { ChecklistCreateForm } from "@/components/ChecklistCreateForm";
import { KWALITEIT_CONFIG } from "@/components/inspection-configs";

export const Route = createFileRoute("/_authenticated/inspecties/kwaliteit")({
  head: () => ({ meta: [{ title: "Kwaliteitscontroles — HSE & Kwaliteit" }] }),
  component: KwaliteitPage,
});

const TYPES = [{ value: "kwaliteitscontrole", label: "Interne kwaliteitscontrole" }];

function KwaliteitPage() {
  return (
    <ReportsList
      queryKey="reports-kwaliteit"
      title="Kwaliteitscontroles"
      description="Interne kwaliteitscontrole (7.1.2) op basis van de BVW-vragenlijst. Beoordeel elk item als OK, NOK of NVT."
      newLabel="Nieuwe kwaliteitscontrole"
      singularNoun="kwaliteitscontrole"
      icon={ClipboardList}
      typeOptions={TYPES}
      defaultType="kwaliteitscontrole"
      locationLabel="Werf / locatie"
      CreateFormComponent={({ onClose, onCreated }) => (
        <ChecklistCreateForm onClose={onClose} onCreated={onCreated} config={KWALITEIT_CONFIG} />
      )}
    />
  );
}
