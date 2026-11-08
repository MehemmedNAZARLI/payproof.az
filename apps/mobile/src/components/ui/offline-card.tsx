import { t } from "@/lib/i18n";

import { Card } from "./card";
import { EmptyState } from "./empty-state";

/** A first load that is waiting for the network: nothing saved to show, and it will load itself. */
export function OfflineCard() {
  return (
    <Card className="p-0">
      <EmptyState icon="wifi-off" title={t.errors.offline} description={t.offline.notLoaded} />
    </Card>
  );
}
