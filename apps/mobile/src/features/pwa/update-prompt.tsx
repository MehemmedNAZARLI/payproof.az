"use client";

import { useSerwist } from "@serwist/turbopack/react";
import { useEffect } from "react";

import { toast } from "@/components/ui/toast-store";
import { t } from "@/lib/i18n";

import { watchForUpdate } from "./sw-update";

const reload = () => window.location.reload();

/** Offers a downloaded app update as a sticky toast; renders nothing itself. */
export function UpdatePrompt() {
  const { serwist } = useSerwist();
  useEffect(() => {
    if (!serwist) return;
    let shown: number | undefined;
    const dispose = watchForUpdate(serwist, {
      offer(apply) {
        if (shown !== undefined) toast.dismiss(shown);
        shown = toast.show({
          tone: "info",
          title: t.pwa.updateTitle,
          description: t.pwa.updateBody,
          sticky: true,
          action: { label: t.common.refresh, onPress: apply },
        });
      },
      reload,
      onTakeover: (callback) =>
        navigator.serviceWorker.addEventListener("controllerchange", callback, { once: true }),
    });
    return () => {
      dispose();
      if (shown !== undefined) toast.dismiss(shown);
    };
  }, [serwist]);
  return null;
}
