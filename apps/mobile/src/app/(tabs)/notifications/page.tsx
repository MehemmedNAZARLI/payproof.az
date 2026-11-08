import type { Metadata } from "next";

import { AppHeader } from "@/components/ui/app-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { t } from "@/lib/i18n";

export const metadata: Metadata = { title: "Bildirişlər" };

// Placeholder so the tab never dead-ends; the notification list replaces it (M-10).
export default function NotificationsPage() {
  return (
    <>
      <AppHeader large title={t.notifications.title} />
      <main className="px-safe pb-tabbar mx-auto max-w-app">
        <Card className="p-0">
          <EmptyState
            icon="bell"
            title={t.notifications.soonTitle}
            description={t.notifications.soonBody}
          />
        </Card>
      </main>
    </>
  );
}
