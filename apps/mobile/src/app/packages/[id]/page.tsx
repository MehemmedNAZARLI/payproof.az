import type { Metadata } from "next";

import { PackageDetailScreen } from "@/features/package-detail/components/package-detail-screen";

export const metadata: Metadata = { title: "Paket" };

export default async function PackagePage({ params }: PageProps<"/packages/[id]">) {
  const { id } = await params;
  return <PackageDetailScreen id={id} />;
}
