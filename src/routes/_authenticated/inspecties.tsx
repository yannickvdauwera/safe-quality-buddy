import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/inspecties")({
  head: () => ({ meta: [{ title: "Inspecties — HSE & Kwaliteit" }] }),
  component: () => <Outlet />,
});
