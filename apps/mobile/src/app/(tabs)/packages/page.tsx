import type { Metadata } from "next";
import { Suspense } from "react";

import { PackagesScreen } from "@/features/packages/components/packages-screen";

export const metadata: Metadata = { title: "Packages" };

// The filter and search live in the URL (useSearchParams), which needs a Suspense boundary.
export default function PackagesPage() {
  return (
    <Suspense>
      <PackagesScreen />
    </Suspense>
  );
}
