import { notFound } from "next/navigation";

import { SessionGate } from "@/features/auth/components/session-gate";
import { GrantsScreen } from "@/features/grants/grants-screen";
import { env } from "@/lib/env";

export const metadata = { title: "UNEC student grant" };
export default function GrantsPage() {
  if (!env.apiMock) notFound();
  return (
    <SessionGate>
      <GrantsScreen />
    </SessionGate>
  );
}
