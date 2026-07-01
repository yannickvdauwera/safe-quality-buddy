import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { ReportsList } from "@/components/ReportsList";
import { ChecklistCreateForm } from "@/components/ChecklistCreateForm";
import { WPI_CONFIG } from "@/components/inspection-configs";

export const Route = createFileRoute("/_authenticated/inspecties/wpi")({
  head: () => ({ meta: [{ title: "Werkplekinspecties — HSE & Kwaliteit" }] }),
  component: WpiPage,
});

const TYPES = [{ value: "werkplekinspectie", label: "Werkplekinspectie" }];

function WpiPage() {
  return (
    <ReportsList
      queryKey="reports-wpi"
      title="Werkplekinspecties"
      description="Volledige werkplekinspectie op basis van de vaste vragenlijst. Elk item wordt beoordeeld als OK, NOK of NVT."
      newLabel="Nieuwe WPI"
      singularNoun="werkplekinspectie"
      icon={ClipboardCheck}
      typeOptions={TYPES}
      defaultType="werkplekinspectie"
      locationLabel="Werf / zone"
      CreateFormComponent={({ onClose, onCreated }) => (
        <ChecklistCreateForm onClose={onClose} onCreated={onCreated} config={WPI_CONFIG} />
      )}
    />
  );
}
