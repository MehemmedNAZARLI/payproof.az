import { SessionGate } from "@/features/auth/components/session-gate";
import { NotificationTabBar } from "@/features/notifications/components/notification-tab-bar";

// Tab roots share one tab bar, so it stays put (and keeps its blur) while tabs switch.
export default function TabsLayout({ children }: LayoutProps<"/">) {
  return (
    <SessionGate>
      {children}
      <NotificationTabBar />
    </SessionGate>
  );
}
