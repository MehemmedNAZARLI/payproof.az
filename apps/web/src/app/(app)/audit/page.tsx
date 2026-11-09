import { Suspense } from "react";
import { SkeletonTable } from "@/components/ui/skeleton";
import { AuditScreen } from "@/features/audit";

export default function AuditPage() {
  // useSearchParams needs a Suspense boundary on a prerendered page
  return (
    <Suspense fallback={<SkeletonTable rows={8} columns={4} />}>
      <AuditScreen />
    </Suspense>
  );
}
