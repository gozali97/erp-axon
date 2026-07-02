import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/hr/")({
  beforeLoad: () => {
    throw redirect({ to: "/app/hr/employees" });
  },
});
