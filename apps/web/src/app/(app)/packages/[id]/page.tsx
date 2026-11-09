import { PackageDetailScreen } from "@/features/package-detail";

export default async function PackagePage({ params }: PageProps<"/packages/[id]">) {
  const { id } = await params;
  return <PackageDetailScreen id={id} />;
}
