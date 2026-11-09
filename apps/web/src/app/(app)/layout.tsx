import { AuthGuard } from "@/features/auth";
import { AppShell } from "@/features/shell";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
