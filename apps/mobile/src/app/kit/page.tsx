import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { SessionGate } from "@/features/auth/components/session-gate";
import { env } from "@/lib/env";

import { KitScreen } from "./kit-screen";

export const metadata: Metadata = { title: "UI kit", robots: { index: false } };

// Component preview for the demo build only (M-03); hidden once the app talks to the real API.
export default function KitPage() {
  if (!env.apiMock) notFound();
  return (
    <SessionGate>
      <KitScreen />
    </SessionGate>
  );
}
