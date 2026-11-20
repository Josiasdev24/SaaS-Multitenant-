import { createFileRoute } from "@tanstack/react-router";

import { AdjustmentsPage } from "@/components/adjustments-page";

export const Route = createFileRoute("/_authenticated/ajustements/reductions")({
  head: () => ({
    meta: [{ title: "Réductions familiales — Complexe Scolaire Omarus Adodo" }],
  }),
  component: () => <AdjustmentsPage kind="reduction_familiale" />,
});
