import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/meldingen")({
  head: () => ({ meta: [{ title: "Meldingen — HSE & Kwaliteit" }] }),
  component: () => <Outlet />,
});
