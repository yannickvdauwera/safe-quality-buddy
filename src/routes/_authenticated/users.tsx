import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/users")({
  beforeLoad: () => {
    throw redirect({ to: "/employees" });
  },
  component: () => null,
});
