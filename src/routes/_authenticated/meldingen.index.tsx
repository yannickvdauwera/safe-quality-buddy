import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/meldingen/")({
  component: () => <Navigate to="/meldingen/intern" replace />,
});
