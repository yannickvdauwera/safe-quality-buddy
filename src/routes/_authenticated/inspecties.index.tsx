import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/inspecties/")({
  component: () => <Navigate to="/inspecties/wpi" replace />,
});
