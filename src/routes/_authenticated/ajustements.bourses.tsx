import { createFileRoute } from "@tanstack/react-router";

import { AdjustmentsPage } from "@/components/adjustments-page";

export const Route = createFileRoute("/_authenticated/ajustements/bourses")({
  head: () => ({
    meta: [{ title: "Bourses — Complexe Scolaire Omarus Adodo" }],
  }),
  component: () => <AdjustmentsPage kind="bourse" />,
});
