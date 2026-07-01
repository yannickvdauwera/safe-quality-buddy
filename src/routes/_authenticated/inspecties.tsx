import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck } from "lucide-react";
import { ReportsList } from "@/components/ReportsList";

export const Route = createFileRoute("/_authenticated/inspecties")({
  head: () => ({ meta: [{ title: "Inspecties — HSE & Kwaliteit" }] }),
  component: InspectiesPage,
});

const TYPES = [
  { value: "werkplekinspectie", label: "Werkplekinspectie" },
];

function InspectiesPage() {
  return (
    <ReportsList
      queryKey="reports-inspecties"
      title="Inspecties"
      description="Werkplekinspecties en rondgangen. Registreer vaststellingen, wijs opvolging toe en volg tot afsluiting."
      newLabel="Nieuwe inspectie"
      singularNoun="inspectie"
      icon={ClipboardCheck}
      typeOptions={TYPES}
      defaultType="werkplekinspectie"
      locationLabel="Locatie / zone"
    />
  );
}
