import { createFileRoute } from "@tanstack/react-router";

import { AdjustmentsPage } from "@/components/adjustments-page";

export const Route = createFileRoute("/_authenticated/ajustements/arrieres")({
  head: () => ({
    meta: [{ title: "Arriérés" }],
  }),
  component: () => <AdjustmentsPage kind="arriere" />,
});
