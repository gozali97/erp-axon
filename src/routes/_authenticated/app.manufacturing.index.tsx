import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/manufacturing/")({
  beforeLoad: () => { throw redirect({ to: "/app/manufacturing/bom" }); },
});
