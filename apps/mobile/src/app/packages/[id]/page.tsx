import type { Metadata } from "next";

import { PackagePreview } from "@/features/packages/components/package-preview";

export const metadata: Metadata = { title: "Paket" };

export default async function PackagePage({ params }: PageProps<"/packages/[id]">) {
  const { id } = await params;
  return <PackagePreview id={id} />;
}
