import { createFileRoute } from "@tanstack/react-router";
import { SafetyObservationsPage } from "@/components/SafetyObservationsPage";

export const Route = createFileRoute("/_authenticated/stop")({
  component: () => <SafetyObservationsPage type="stop" />,
});
