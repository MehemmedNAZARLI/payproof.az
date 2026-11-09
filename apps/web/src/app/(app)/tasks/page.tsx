import { Suspense } from "react";
import { SkeletonTable } from "@/components/ui/skeleton";
import { TasksScreen } from "@/features/tasks";

export default function TasksPage() {
  // useSearchParams needs a Suspense boundary on a prerendered page
  return (
    <Suspense fallback={<SkeletonTable rows={5} columns={7} />}>
      <TasksScreen />
    </Suspense>
  );
}
