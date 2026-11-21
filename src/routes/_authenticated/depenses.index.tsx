import { createFileRoute } from "@tanstack/react-router";

import { LedgerPage } from "@/components/ledger-page";

export const Route = createFileRoute("/_authenticated/depenses/")({
  head: () => ({
    meta: [{ title: "Dépenses" }],
  }),
  component: () => <LedgerPage kind="expenses" />,
});
