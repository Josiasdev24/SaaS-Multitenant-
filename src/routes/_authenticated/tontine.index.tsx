import { createFileRoute } from "@tanstack/react-router";

import { TontinePage } from "@/components/tontine-page";

export const Route = createFileRoute("/_authenticated/tontine/")({
  head: () => ({
    meta: [{ title: "Tontine — Complexe Scolaire Omarus Adodo" }],
  }),
  component: () => <TontinePage />,
});
