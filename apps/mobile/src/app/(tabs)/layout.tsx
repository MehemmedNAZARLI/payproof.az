import { TabBar } from "@/components/ui/tab-bar";
import { SessionGate } from "@/features/auth/components/session-gate";

// Tab roots share one tab bar, so it stays put (and keeps its blur) while tabs switch.
export default function TabsLayout({ children }: LayoutProps<"/">) {
  return (
    <SessionGate>
      {children}
      <TabBar />
    </SessionGate>
  );
}
