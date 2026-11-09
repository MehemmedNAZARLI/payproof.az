import { Suspense } from "react";
import { SkeletonTable } from "@/components/ui/skeleton";
import { PackageListScreen } from "@/features/packages";

export default function PackagesPage() {
  // useSearchParams needs a Suspense boundary on a prerendered page
  return (
    <Suspense fallback={<SkeletonTable rows={6} columns={8} />}>
      <PackageListScreen />
    </Suspense>
  );
}
