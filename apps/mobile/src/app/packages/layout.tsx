import { SessionGate } from "@/features/auth/components/session-gate";

// Detail screens sit outside the tab group (no tab bar), behind the same sign-in guard.
export default function PackageLayout({ children }: LayoutProps<"/packages">) {
  return <SessionGate>{children}</SessionGate>;
}
