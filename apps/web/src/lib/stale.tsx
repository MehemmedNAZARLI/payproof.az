"use client";

import { actionLabel } from "@payproof/api-client/i18n";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Banner } from "@/components/ui/layout";
import { useMe } from "@/features/auth";
import { onLiveEvent } from "./live";

/**
 * While a dialog works on `version` of a package (approve, export, edit — W-11/W-13): the newer
 * version someone else has made since, or null. The server would answer 409 anyway; this says so
 * before the user tries. Own changes don't count (the dialog's own upload bumps the version too) —
 * so the viewer's own second tab doesn't show the banner either: W-11/W-13 must still handle 409.
 */
export function usePackageChangedSince(packageId: string, version: number): number | null {
  const me = useMe().data?.id;
  const [seen, setSeen] = useState<{ packageId: string; version: number } | null>(null);
  useEffect(
    () =>
      onLiveEvent((event) => {
        if (event.package_id !== packageId || !event.package_version || event.actor_id === me)
          return;
        const newer = event.package_version;
        setSeen((prev) =>
          prev?.packageId === packageId && prev.version >= newer
            ? prev
            : { packageId, version: newer },
        );
      }),
    [packageId, me],
  );
  return seen?.packageId === packageId && seen.version > version ? seen.version : null;
}

// shortcut: text lives here until the shared i18n package gets live-update keys
export function StaleBanner({ version, onRefresh }: { version: number; onRefresh: () => void }) {
  return (
    <Banner
      tone="warning"
      role="alert"
      title={`Başqa istifadəçi paketi yenilədi (v${version}).`}
      actions={
        <Button variant="outline" onClick={onRefresh}>
          <RefreshCw aria-hidden />
          {actionLabel.refresh}
        </Button>
      }
    >
      Davam etmək üçün yenidən baxın.
    </Banner>
  );
}
