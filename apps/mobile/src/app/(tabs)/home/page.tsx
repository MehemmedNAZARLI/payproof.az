import type { Metadata } from "next";

import { HomeScreen } from "@/features/home/components/home-screen";

export const metadata: Metadata = { title: "Əsas" };

export default function HomePage() {
  return <HomeScreen />;
}
