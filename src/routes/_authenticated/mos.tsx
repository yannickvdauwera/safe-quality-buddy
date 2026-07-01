import { createFileRoute } from "@tanstack/react-router";
import { SafetyObservationsPage } from "@/components/SafetyObservationsPage";

export const Route = createFileRoute("/_authenticated/mos")({
  component: () => <SafetyObservationsPage type="mos" />,
});
