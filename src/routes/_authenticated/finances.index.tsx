import { createFileRoute } from "@tanstack/react-router";

import { FinanceDashboard } from "@/components/finance-dashboard";

export const Route = createFileRoute("/_authenticated/finances/")({
  head: () => ({
    meta: [{ title: "Tableau financier" }],
  }),
  component: () => <FinanceDashboard />,
});
