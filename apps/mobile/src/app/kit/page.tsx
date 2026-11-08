import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { KitScreen } from "./kit-screen";

export const metadata: Metadata = { title: "UI dəsti", robots: { index: false } };

// Component preview for the demo build only (M-03); hidden once the app talks to the real API.
export default function KitPage() {
  if (process.env.NEXT_PUBLIC_API_MOCK === "0") notFound();
  return <KitScreen />;
}
