import { createFileRoute } from "@tanstack/react-router";

import { LedgerPage } from "@/components/ledger-page";

export const Route = createFileRoute("/_authenticated/recettes/")({
  head: () => ({
    meta: [{ title: "Recettes" }],
  }),
  component: () => <LedgerPage kind="incomes" />,
});
